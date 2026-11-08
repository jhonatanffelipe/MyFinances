-- =====================================================================
-- MyFinances · 002_rls.sql
-- Regra geral: nada é acessível sem login; tudo é filtrado por família.
-- Família, membros e convites só mudam via RPC (security definer).
-- =====================================================================

-- ---------- Defesa em profundidade: anon não toca em nada ----------
revoke all on all tables    in schema public from anon;
revoke all on all functions in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------- Helpers (security definer para não recursar no RLS) ----------
create or replace function public.is_family_member(p_family_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id and fm.user_id = (select auth.uid()) and fm.active
  );
$$;

create or replace function public.is_family_admin(p_family_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id and fm.user_id = (select auth.uid())
      and fm.active and fm.role in ('OWNER', 'ADMIN')
  );
$$;

-- Famílias ativas do usuário logado. Nas policies, usar sempre
-- `family_id in (select public.my_family_ids())`: o Postgres calcula a lista UMA vez
-- por consulta (InitPlan), em vez de chamar is_family_member() linha a linha.
-- Com 50 mil lançamentos por família, o dashboard caiu de ~250 ms para ~37 ms.
create or replace function public.my_family_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select fm.family_id from public.family_members fm
  where fm.user_id = (select auth.uid()) and fm.active;
$$;

-- ---------- Liga RLS em tudo ----------
alter table public.app_meta               enable row level security;
alter table public.profiles               enable row level security;
alter table public.families               enable row level security;
alter table public.family_members         enable row level security;
alter table public.family_invites         enable row level security;
alter table public.categories             enable row level security;
alter table public.credit_cards           enable row level security;
alter table public.fixed_expenses         enable row level security;
alter table public.fixed_expense_payments enable row level security;
alter table public.movements              enable row level security;

-- app_meta: só leitura
drop policy if exists app_meta_read on public.app_meta;
create policy app_meta_read on public.app_meta for select to authenticated using (true);

-- profiles: vejo o meu e o de quem divide família comigo; edito só o meu
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or exists (
    select 1 from public.family_members me
    join public.family_members other on other.family_id = me.family_id
    where me.user_id = (select auth.uid()) and me.active and other.user_id = profiles.id
  )
);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- families / members / invites: leitura para membros; escrita só via RPC
drop policy if exists families_read on public.families;
create policy families_read on public.families for select to authenticated
  using (id in (select public.my_family_ids()));
drop policy if exists families_update on public.families;
create policy families_update on public.families for update to authenticated
  using (public.is_family_admin(id)) with check (public.is_family_admin(id));

drop policy if exists family_members_read on public.family_members;
create policy family_members_read on public.family_members for select to authenticated
  using (family_id in (select public.my_family_ids()));

drop policy if exists family_invites_read on public.family_invites;
create policy family_invites_read on public.family_invites for select to authenticated
  using (public.is_family_admin(family_id));

-- Cadastros compartilhados (categorias, cartões, fixos, baixas): qualquer membro lê e escreve
do $$
declare t text;
begin
  foreach t in array array['categories', 'credit_cards', 'fixed_expenses', 'fixed_expense_payments'] loop
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('drop policy if exists %1$s_write on public.%1$s', t);
    execute format('create policy %1$s_read  on public.%1$s for select to authenticated using (family_id in (select public.my_family_ids()))', t);
    execute format('create policy %1$s_write on public.%1$s for all    to authenticated using (family_id in (select public.my_family_ids())) with check (family_id in (select public.my_family_ids()))', t);
  end loop;
end $$;

-- Lançamentos: decisão do produto = todos os membros leem e editam tudo da família.
-- A única amarra extra é created_by refletir quem realmente inseriu (auditoria).
drop policy if exists movements_read on public.movements;
create policy movements_read on public.movements for select to authenticated
  using (family_id in (select public.my_family_ids()));

drop policy if exists movements_insert on public.movements;
create policy movements_insert on public.movements for insert to authenticated
  with check (family_id in (select public.my_family_ids()) and created_by = (select auth.uid()));

drop policy if exists movements_update on public.movements;
create policy movements_update on public.movements for update to authenticated
  using (family_id in (select public.my_family_ids()))
  with check (family_id in (select public.my_family_ids()));

drop policy if exists movements_delete on public.movements;
create policy movements_delete on public.movements for delete to authenticated
  using (family_id in (select public.my_family_ids()));

-- created_by não pode ser reescrito num update
create or replace function public.keep_created_by() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_by := old.created_by;
  return new;
end $$;
drop trigger if exists movements_keep_created_by on public.movements;
create trigger movements_keep_created_by before update on public.movements
for each row execute function public.keep_created_by();

-- ---------- Realtime (postgres_changes respeita o RLS acima) ----------
do $$
declare t text;
begin
  foreach t in array array['movements', 'categories', 'credit_cards', 'fixed_expenses', 'fixed_expense_payments', 'family_members'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- RPCs de família (únicos caminhos de escrita) ----------
create or replace function public.create_family(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.families (name, created_by) values (trim(p_name), auth.uid()) returning id into v_id;
  insert into public.family_members (family_id, user_id, role) values (v_id, auth.uid(), 'OWNER');
  return v_id;
end $$;

-- Retorna o token EM CLARO uma única vez; no banco fica só o hash.
create or replace function public.create_family_invite(p_family_id uuid, p_role public.family_role default 'MEMBER')
returns text
language plpgsql security definer set search_path = '' as $$
declare v_token text := encode(extensions.gen_random_bytes(24), 'base64');
begin
  if not public.is_family_admin(p_family_id) then raise exception 'forbidden'; end if;
  if p_role = 'OWNER' then raise exception 'invalid_role'; end if;
  v_token := translate(v_token, '+/=', '-_');
  insert into public.family_invites (family_id, token_hash, role, created_by)
  values (p_family_id, encode(extensions.digest(v_token, 'sha256'), 'hex'), p_role, auth.uid());
  return v_token;
end $$;

create or replace function public.accept_family_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_inv public.family_invites;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_inv from public.family_invites
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;                                   -- evita uso duplo concorrente
  if not found or v_inv.used_at is not null or v_inv.expires_at < now() then
    raise exception 'invalid_or_expired_invite';
  end if;
  insert into public.family_members (family_id, user_id, role)
  values (v_inv.family_id, auth.uid(), v_inv.role)
  on conflict (family_id, user_id) do update set active = true;
  update public.family_invites set used_by = auth.uid(), used_at = now() where id = v_inv.id;
  return v_inv.family_id;
end $$;

create or replace function public.set_member_active(p_family_id uuid, p_user_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_family_admin(p_family_id) then raise exception 'forbidden'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot_change_self'; end if;
  update public.family_members set active = p_active where family_id = p_family_id and user_id = p_user_id;
end $$;

create or replace function public.app_schema_version() returns int
language sql stable security definer set search_path = '' as $$
  select value::int from public.app_meta where key = 'schema_version';
$$;

revoke all on function public.create_family(text)                                from public, anon;
revoke all on function public.create_family_invite(uuid, public.family_role)      from public, anon;
revoke all on function public.accept_family_invite(text)                          from public, anon;
revoke all on function public.set_member_active(uuid, uuid, boolean)              from public, anon;
grant execute on function public.create_family(text)                              to authenticated;
grant execute on function public.create_family_invite(uuid, public.family_role)    to authenticated;
grant execute on function public.accept_family_invite(text)                        to authenticated;
grant execute on function public.set_member_active(uuid, uuid, boolean)            to authenticated;
-- Versão precisa ser legível ANTES do login (tela de conexão valida o schema)
grant execute on function public.app_schema_version() to anon, authenticated;
