// Teste de ponta a ponta do pareamento por QR contra o Supabase local (yarn db:test:e2e).
// Usa só a publishable key, como o app: computador logado + celular sem sessão.
// Requer `yarn db:start` e `yarn functions:serve` rodando.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

const status = JSON.parse(execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString());
const API = status.API_URL;
const KEY = status.PUBLISHABLE_KEY ?? status.ANON_KEY;

async function call(path, { token, body, method = 'POST' } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      apikey: KEY,
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

const claims = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
const rpc = (fn, token, body = {}) => call(`/rest/v1/rpc/${fn}`, { token, body });
const pair = (body) => call('/functions/v1/pair-device', { body });

const step = (msg) => console.log(`ok - ${msg}`);

// 1. Computador: cria conta, família e gera o QR
const email = `pc-${Date.now()}@test.local`;
const signup = await call('/auth/v1/signup', { body: { email, password: 'senha1234', data: { name: 'Jhonatan' } } });
assert.equal(signup.status, 200, JSON.stringify(signup.data));
const pc = signup.data;
const pcSession = claims(pc.access_token).session_id;
assert.ok(pcSession, 'JWT do computador traz session_id');
step('cadastro e claim session_id no JWT');

const fam = await rpc('create_family', pc.access_token, { p_name: 'Família Teste' });
assert.equal(fam.status, 200, JSON.stringify(fam.data));
const link = await rpc('create_device_link', pc.access_token, { p_family_id: fam.data });
assert.equal(link.status, 200, JSON.stringify(link.data));
assert.ok(link.data.pair_token && link.data.invite_token);
step('create_device_link devolve pair_token e invite_token (OWNER)');

// 2. Celular: lê o QR
const scan = await pair({ action: 'scan', token: link.data.pair_token, device_name: 'Moto G' });
assert.equal(scan.data.status, 'WAITING_APPROVAL', JSON.stringify(scan.data));
assert.equal(scan.data.user_name, 'Jhonatan');
assert.equal(scan.data.family_name, 'Família Teste');
const scanAgain = await pair({ action: 'scan', token: link.data.pair_token, device_name: 'Intruso' });
assert.equal(scanAgain.status, 410, 'segundo celular não consegue ler o mesmo QR');
step('scan atômico: só o primeiro celular pega o QR');

const pending = await pair({ action: 'status', token: link.data.pair_token });
assert.equal(pending.data.status, 'WAITING_APPROVAL');

// 3. Computador: vê o pedido (o app recebe via Realtime) e permite
const rows = await call('/rest/v1/device_pairings?select=id,device_name&status=eq.WAITING_APPROVAL', {
  token: pc.access_token,
  method: 'GET',
});
assert.equal(rows.data.length, 1);
assert.equal(rows.data[0].device_name, 'Moto G');
const ok = await rpc('resolve_device_pairing', pc.access_token, { p_pairing_id: rows.data[0].id, p_approve: true });
assert.equal(ok.status, 204, JSON.stringify(ok.data));
step('computador aprova o pareamento');

// 4. Celular: consome a aprovação e cria a PRÓPRIA sessão
const approved = await pair({ action: 'status', token: link.data.pair_token });
assert.equal(approved.data.status, 'APPROVED', JSON.stringify(approved.data));
assert.ok(approved.data.token_hash);
const consumedAgain = await pair({ action: 'status', token: link.data.pair_token });
assert.equal(consumedAgain.data.status, 'CONSUMED', 'aprovação é de uso único');

const verify = await call('/auth/v1/verify', { body: { type: 'email', token_hash: approved.data.token_hash } });
assert.equal(verify.status, 200, JSON.stringify(verify.data));
const phone = verify.data;
const phoneSession = claims(phone.access_token).session_id;
assert.equal(claims(phone.access_token).sub, pc.user.id, 'celular entra na mesma conta');
assert.notEqual(phoneSession, pcSession, 'celular tem sessão própria');
step('verifyOtp(token_hash, type email) cria sessão própria do celular');

const reg = await rpc('register_device', phone.access_token, { p_device_name: 'Moto G', p_platform: 'android' });
assert.equal(reg.status, 204, JSON.stringify(reg.data));
const famPhone = await call('/rest/v1/families?select=name', { token: phone.access_token, method: 'GET' });
assert.equal(famPhone.data[0].name, 'Família Teste');
step('celular registra o aparelho e lê a família');

// 5. Computador: desconecta o celular
const devices = await call('/rest/v1/user_devices?select=id,device_name', { token: pc.access_token, method: 'GET' });
const moto = devices.data.find((d) => d.device_name === 'Moto G');
const revoke = await rpc('revoke_device', pc.access_token, { p_device_id: moto.id });
assert.equal(revoke.status, 204, JSON.stringify(revoke.data));
const refresh = await call('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: phone.refresh_token } });
assert.notEqual(refresh.status, 200, 'refresh token do celular deixa de funcionar');
const pcRefresh = await call('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: pc.refresh_token } });
assert.equal(pcRefresh.status, 200, 'sessão do computador continua válida');
step('revoke_device derruba o refresh do celular e preserva o computador');

// 6. Fallback: sem a função, o ping falha (simulado com nome inexistente)
const missing = await call('/functions/v1/funcao-inexistente', { body: { action: 'ping' } });
assert.notEqual(missing.status, 200);
step('ping de função ausente não responde 200 (app cai no login com e-mail preenchido)');

console.log('\nPareamento por QR: todos os passos passaram.');
