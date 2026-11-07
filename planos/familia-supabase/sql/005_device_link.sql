-- =====================================================================
-- MyFinances · 005_device_link.sql  (RASCUNHO — validar na Etapa 5)
-- "Conectar celular" por QR Code: pareamento (mesma pessoa, outro aparelho)
-- + convite (outra pessoa da família) no mesmo QR.
--
-- Estados do pareamento:
--   WAITING_SCAN ─(celular lê o QR; Edge Function)─► WAITING_APPROVAL
--   WAITING_APPROVAL ─(computador clica Permitir)──► APPROVED  ou  DENIED
--   APPROVED ─(Edge Function entrega o login)──────► CONSUMED
--   qualquer um ─(passou expires_at)───────────────► tratado como expirado
-- =====================================================================

do $$ begin
  create type public.pairing_status as enum ('WAITING_SCAN', 'WAITING_APPROVAL', 'APPROVED', 'DENIED', 'CONSUMED');
exception when duplicate_object then null; end $$;

create table if not exists public.device_pairings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  family_id    uuid not null references public.families(id) on delete cascade,
  token_hash   text not null unique,              -- sha256 do token do QR
  status       public.pairing_status not null default 'WAITING_SCAN',
  device_name  text,                              -- informado pelo celular ("Moto G")
  expires_at   timestamptz not null default now() + interval '2 minutes',
  approved_at  timestamptz,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists device_pairings_user_idx on public.device_pairings (user_id, created_at desc);

-- Aparelhos conectados (para "Perfil → Aparelhos conectados" e desconectar)
create table if not exists public.user_devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id   uuid not null,                     -- claim session_id do JWT do aparelho
  device_name  text not null,
  platform     text not null check (platform in ('desktop', 'android', 'ios')),
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (user_id, session_id)
);

alter table public.device_pairings enable row level security;
alter table public.user_devices    enable row level security;

-- O computador acompanha (Realtime) só os próprios pedidos; escrita só via RPC/Edge Function
create policy device_pairings_read on public.device_pairings for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_devices_read on public.user_devices for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.device_pairings from authenticated;
revoke insert, update, delete on public.user_devices    from authenticated;

alter publication supabase_realtime add table public.device_pairings;

-- ---------- Computador: gerar o QR ----------
-- Retorna o token de pareamento e, se o usuário for OWNER/ADMIN, um token de convite
-- de curta duração para o caminho "Sou outra pessoa". Pedidos antigos ainda abertos
-- do mesmo usuário são invalidados (só um QR válido por vez).
create or replace function public.create_device_link(p_family_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pair   text := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_invite text := null;
begin
  if not public.is_family_member(p_family_id) then raise exception 'forbidden'; end if;

  update public.device_pairings set expires_at = now()
   where user_id = auth.uid() and status in ('WAITING_SCAN', 'WAITING_APPROVAL') and expires_at > now();

  insert into public.device_pairings (user_id, family_id, token_hash)
  values (auth.uid(), p_family_id, encode(extensions.digest(v_pair, 'sha256'), 'hex'));

  if public.is_family_admin(p_family_id) then
    v_invite := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
    insert into public.family_invites (family_id, token_hash, role, created_by, expires_at)
    values (p_family_id, encode(extensions.digest(v_invite, 'sha256'), 'hex'), 'MEMBER', auth.uid(),
            now() + interval '10 minutes');
  end if;

  return jsonb_build_object('pair_token', v_pair, 'invite_token', v_invite,
                            'expires_in', 120);
end $$;

-- ---------- Computador: Permitir / Negar ----------
create or replace function public.resolve_device_pairing(p_pairing_id uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.device_pairings
     set status = case when p_approve then 'APPROVED'::public.pairing_status else 'DENIED' end,
         approved_at = case when p_approve then now() end,
         -- depois de aprovado, o celular tem 1 minuto para buscar o login
         expires_at = case when p_approve then now() + interval '1 minute' else expires_at end
   where id = p_pairing_id and user_id = auth.uid()
     and status = 'WAITING_APPROVAL' and expires_at > now();
  if not found then raise exception 'pairing_not_pending'; end if;
end $$;

-- ---------- Qualquer aparelho logado: registrar-se / listar / desconectar ----------
create or replace function public.register_device(p_device_name text, p_platform text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_session uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if v_session is null then raise exception 'not_authenticated'; end if;
  insert into public.user_devices (user_id, session_id, device_name, platform)
  values (auth.uid(), v_session, left(trim(p_device_name), 60), p_platform)
  on conflict (user_id, session_id) do update set last_seen_at = now(), device_name = excluded.device_name;
end $$;

-- Desconectar: apaga a sessão no Auth (os refresh tokens caem em cascata). O access token
-- já emitido continua válido até expirar (padrão 1 h); depois o aparelho é deslogado.
create or replace function public.revoke_device(p_device_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_session uuid;
begin
  delete from public.user_devices where id = p_device_id and user_id = auth.uid()
  returning session_id into v_session;
  if v_session is null then raise exception 'device_not_found'; end if;
  delete from auth.sessions where id = v_session and user_id = auth.uid();
end $$;

revoke all on function public.create_device_link(uuid)               from public, anon;
revoke all on function public.resolve_device_pairing(uuid, boolean)  from public, anon;
revoke all on function public.register_device(text, text)            from public, anon;
revoke all on function public.revoke_device(uuid)                    from public, anon;
grant execute on function public.create_device_link(uuid)              to authenticated;
grant execute on function public.resolve_device_pairing(uuid, boolean) to authenticated;
grant execute on function public.register_device(text, text)           to authenticated;
grant execute on function public.revoke_device(uuid)                   to authenticated;

-- Faxina (pg_cron, se disponível no projeto): apagar pedidos com mais de 1 dia.
-- select cron.schedule('mf-pairings-cleanup', '0 4 * * *',
--   $$delete from public.device_pairings where created_at < now() - interval '1 day'$$);
