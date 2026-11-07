// =====================================================================
// MyFinances · Edge Function "pair-device" (validada por supabase/tests/pair-device.e2e.mjs)
//
// Única peça do sistema que usa a service_role key. Ela é injetada pelo
// próprio Supabase como variável de ambiente da função e NUNCA sai daqui
// (não vai para o app, não vai para o QR).
//
// Chamada pelo CELULAR ainda sem sessão. Por isso a função é publicada com
// "Verify JWT" desligado (`supabase functions deploy pair-device --no-verify-jwt`):
// quem autentica o pedido é o token do QR (256 bits, uso único, expira em
// 2 min) + a aprovação manual no computador.
//
// Ações (POST JSON):
//   { action: "ping" }                          -> { ok: true }  (o app detecta se a função existe)
//   { action: "scan",   token, device_name }    -> { status: "WAITING_APPROVAL", user_name, family_name }
//   { action: "status", token }                 -> { status } | { status: "APPROVED", email, token_hash }
//
// Com { token_hash }, o celular chama supabase.auth.verifyOtp({ token_hash, type: "email" })
// e ganha uma SESSÃO PRÓPRIA (não compartilha o refresh token do computador).
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: { action?: string; token?: string; device_name?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  if (body.action === 'ping') return json({ ok: true });

  if (typeof body.token !== 'string' || body.token.length < 32) return json({ error: 'invalid_token' }, 400);
  const tokenHash = await sha256Hex(body.token);
  const now = new Date().toISOString();

  // ---------- Celular leu o QR ----------
  if (body.action === 'scan') {
    const deviceName = (body.device_name ?? 'Celular').trim().slice(0, 60) || 'Celular';
    // UPDATE condicional = atômico: só um celular consegue "pegar" o QR
    const { data, error } = await admin
      .from('device_pairings')
      .update({ status: 'WAITING_APPROVAL', device_name: deviceName })
      .eq('token_hash', tokenHash)
      .eq('status', 'WAITING_SCAN')
      .gt('expires_at', now)
      .select('user_id, family_id')
      .maybeSingle();
    if (error || !data) return json({ error: 'invalid_or_expired' }, 410);

    const [{ data: profile }, { data: family }] = await Promise.all([
      admin.from('profiles').select('name').eq('id', data.user_id).single(),
      admin.from('families').select('name').eq('id', data.family_id).single(),
    ]);
    return json({ status: 'WAITING_APPROVAL', user_name: profile?.name, family_name: family?.name });
  }

  // ---------- Celular consulta (polling a cada ~2 s) ----------
  if (body.action === 'status') {
    // Tenta consumir: só funciona se o computador já aprovou e ainda não expirou
    const { data: consumed } = await admin
      .from('device_pairings')
      .update({ status: 'CONSUMED', consumed_at: now })
      .eq('token_hash', tokenHash)
      .eq('status', 'APPROVED')
      .gt('expires_at', now)
      .select('user_id')
      .maybeSingle();

    if (!consumed) {
      const { data: row } = await admin
        .from('device_pairings')
        .select('status, expires_at')
        .eq('token_hash', tokenHash)
        .maybeSingle();
      if (!row || Date.parse(row.expires_at) <= Date.parse(now)) return json({ status: 'EXPIRED' });
      // Aprovado entre o UPDATE acima e este SELECT (o computador clicou "Permitir" no meio
      // da consulta): ainda não foi consumido aqui, então o celular consulta de novo.
      if (row.status === 'APPROVED') return json({ status: 'WAITING_APPROVAL' });
      return json({ status: row.status }); // WAITING_APPROVAL | DENIED | CONSUMED
    }

    const { data: user, error: userErr } = await admin.auth.admin.getUserById(consumed.user_id);
    if (userErr || !user?.user?.email) return json({ error: 'user_not_found' }, 500);

    // generateLink NÃO envia e-mail: só devolve o hashed_token para o verifyOtp
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.user.email,
    });
    if (linkErr || !link?.properties?.hashed_token) return json({ error: 'link_failed' }, 500);

    return json({ status: 'APPROVED', email: user.user.email, token_hash: link.properties.hashed_token });
  }

  return json({ error: 'unknown_action' }, 400);
});
