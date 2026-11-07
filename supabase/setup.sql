-- =====================================================================
-- MyFinances 2.0.0 · setup.sql (GERADO por yarn db:bundle — não editar)
-- Cole tudo no SQL Editor do seu projeto Supabase e clique em Run.
-- Pode ser executado de novo: os comandos são idempotentes.
-- =====================================================================
begin;

-- >>>>>>>>>> 20261107000001_schema.sql
-- =====================================================================
-- MyFinances · 001_schema.sql
-- Idempotente o suficiente para rodar no SQL Editor de um projeto novo.
-- Requer PostgreSQL 15+ (ON DELETE SET NULL com lista de colunas).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Metadados / versão do schema ----------
create table if not exists public.app_meta (
  key   text primary key,
  value text not null
);
insert into public.app_meta (key, value) values ('schema_version', '1')
on conflict (key) do update set value = excluded.value;

-- ---------- Tipos ----------
do $$ begin
  create type public.family_role      as enum ('OWNER', 'ADMIN', 'MEMBER');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.transaction_type as enum ('INCOME', 'EXPENSE');
exception when duplicate_object then null; end $$;
-- Lançamentos aceitam também TRANSFER (entre membros); categorias/fixos seguem INCOME/EXPENSE.
do $$ begin
  create type public.movement_type    as enum ('INCOME', 'EXPENSE', 'TRANSFER');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.recurrence      as enum ('MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');
exception when duplicate_object then null; end $$;

-- ---------- Perfis (1:1 com auth.users) ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null check (length(trim(name)) >= 2),
  phone      text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Famílias ----------
create table if not exists public.families (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) >= 2),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id  uuid not null references public.families(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.family_role not null default 'MEMBER',
  -- Remoção é lógica: o histórico de lançamentos do membro continua na família.
  active     boolean not null default true,
  joined_at  timestamptz not null default now(),
  primary key (family_id, user_id)
);
create index if not exists family_members_user_idx on public.family_members (user_id) where active;

create table if not exists public.family_invites (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  token_hash  text not null unique,              -- sha256 do token; o token em claro nunca é gravado
  role        public.family_role not null default 'MEMBER' check (role <> 'OWNER'),
  created_by  uuid not null default auth.uid() references auth.users(id),
  expires_at  timestamptz not null default now() + interval '7 days',
  used_by     uuid references auth.users(id),
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------- Cadastros da família ----------
create table if not exists public.categories (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  name          text not null,
  description   text,
  type          public.transaction_type not null,
  color         text,
  icon          text,
  monthly_limit numeric(14,2) check (monthly_limit is null or monthly_limit >= 0),
  created_at    timestamptz not null default now(),
  unique (family_id, id),
  unique (family_id, type, name)
);

create table if not exists public.credit_cards (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  owner_id    uuid references auth.users(id),     -- de quem é o cartão (opcional)
  description text not null,
  color       text not null default '#8b5cf6',
  due_day     smallint not null check (due_day between 1 and 31),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (family_id, id)
);

create table if not exists public.fixed_expenses (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families(id) on delete cascade,
  member_id      uuid references auth.users(id),  -- responsável (opcional)
  description    text not null,
  amount         numeric(14,2) not null check (amount > 0),
  type           public.transaction_type not null default 'EXPENSE',
  category_id    uuid,
  credit_card_id uuid,
  recurrence     public.recurrence not null default 'MONTHLY',
  due_day        smallint not null check (due_day between 1 and 31),
  start_date     date not null,
  end_date       date check (end_date is null or end_date >= start_date),
  active         boolean not null default true,
  notes          text,
  created_by     uuid not null default auth.uid() references auth.users(id),
  created_at     timestamptz not null default now(),
  unique (family_id, id),
  foreign key (family_id, category_id)    references public.categories(family_id, id)   on delete set null (category_id),
  foreign key (family_id, credit_card_id) references public.credit_cards(family_id, id) on delete set null (credit_card_id)
);

create table if not exists public.fixed_expense_payments (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null,
  fixed_expense_id uuid not null,
  year_month       char(7) not null check (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  paid_by          uuid not null default auth.uid() references auth.users(id),
  paid_at          timestamptz not null default now(),
  unique (fixed_expense_id, year_month),
  foreign key (family_id, fixed_expense_id) references public.fixed_expenses(family_id, id) on delete cascade
);

-- ---------- Lançamentos ----------
create table if not exists public.movements (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families(id) on delete cascade,
  member_id        uuid not null default auth.uid(),  -- DE QUEM é o gasto/receita (em TRANSFER: quem envia)
  to_member_id     uuid,                              -- só em TRANSFER: quem recebe
  created_by       uuid not null default auth.uid() references auth.users(id), -- quem digitou
  description      text not null,
  amount           numeric(14,2) not null check (amount > 0),
  date             date not null,
  type             public.movement_type not null,
  category_id      uuid,
  credit_card_id   uuid,
  fixed_expense_id uuid,
  notes            text,
  import_hash      text,                              -- dedupe da importação de extratos
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Transferência: exige destinatário diferente do remetente e não tem categoria.
  -- Receita/despesa: não tem destinatário.
  constraint movements_transfer_chk check (
    (type = 'TRANSFER' and to_member_id is not null and to_member_id <> member_id and category_id is null)
    or (type <> 'TRANSFER' and to_member_id is null)
  ),
  foreign key (family_id, member_id)        references public.family_members(family_id, user_id),
  foreign key (family_id, to_member_id)     references public.family_members(family_id, user_id),
  foreign key (family_id, category_id)      references public.categories(family_id, id)     on delete set null (category_id),
  foreign key (family_id, credit_card_id)   references public.credit_cards(family_id, id)   on delete set null (credit_card_id),
  foreign key (family_id, fixed_expense_id) references public.fixed_expenses(family_id, id) on delete set null (fixed_expense_id)
);

create index if not exists movements_family_date_idx        on public.movements (family_id, date desc);
create index if not exists movements_family_member_date_idx on public.movements (family_id, member_id, date desc);
create index if not exists movements_family_to_member_idx  on public.movements (family_id, to_member_id, date desc) where to_member_id is not null;
create index if not exists movements_family_category_idx   on public.movements (family_id, category_id) where category_id is not null;
create index if not exists movements_family_card_idx        on public.movements (family_id, credit_card_id) where credit_card_id is not null;
create unique index if not exists movements_import_hash_uq  on public.movements (family_id, import_hash) where import_hash is not null;
create index if not exists fixed_expenses_family_idx        on public.fixed_expenses (family_id) where active;

-- ---------- updated_at ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists movements_touch on public.movements;
create trigger movements_touch before update on public.movements
for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

-- ---------- Perfil automático no cadastro ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- >>>>>>>>>> 20261107000002_rls.sql
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

-- >>>>>>>>>> 20261107000003_sync.sql
-- =====================================================================
-- MyFinances · 003_sync.sql
-- Suporte à sincronização offline-first (SQLite local <-> Supabase).
--
-- Decisões:
--  * Exclusão é LÓGICA (deleted_at). Sem tombstone, um dispositivo offline
--    nunca saberia que outro apagou o registro.
--  * Cursor de pull = xid8 da transação que alterou a linha (change_xid),
--    NÃO timestamp (relógio do celular erra) e NÃO sequence (uma sequence
--    alocada por transação ainda aberta pode "furar" o cursor).
--    Regra: devolve linhas com change_xid >= cursor; novo cursor =
--    pg_snapshot_xmin(pg_current_snapshot()). Tudo abaixo do xmin já
--    terminou, então nada é perdido. Linhas podem vir repetidas no pull
--    seguinte — o upsert local é idempotente.
--  * Conflito: "último push vence" por linha. Se o cliente editou a partir
--    de uma versão velha (base_xid <> change_xid atual), aplica mesmo assim
--    e devolve o conflito para o app registrar no log local.
-- =====================================================================

-- ---------- Carimbo de sync (antes do bloco que cria os triggers) ----------
create or replace function public.sync_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.change_xid := pg_current_xact_id();
  new.updated_at := now();
  return new;
end $$;

-- ---------- Colunas de sync nas tabelas sincronizadas ----------
do $$
declare t text;
begin
  foreach t in array array['categories', 'credit_cards', 'fixed_expenses', 'fixed_expense_payments', 'movements'] loop
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', t);
    execute format('alter table public.%I add column if not exists deleted_at timestamptz', t);
    execute format('alter table public.%I add column if not exists change_xid xid8 not null default pg_current_xact_id()', t);
    execute format('create index if not exists %1$s_sync_idx on public.%1$I (family_id, change_xid)', t);

    execute format('drop trigger if exists %1$s_sync_stamp on public.%1$I', t);
    execute format('create trigger %1$s_sync_stamp before insert or update on public.%1$I
                    for each row execute function public.sync_stamp()', t);

    -- Hard delete proibido para o app: só soft delete via sync_push
    execute format('revoke delete on public.%I from authenticated', t);
  end loop;
end $$;

-- ---------- Unicidade só entre linhas vivas ----------
-- Com soft delete, uma categoria apagada não pode bloquear outra com o mesmo nome,
-- e um lançamento importado e depois apagado não pode impedir a reimportação.
alter table public.categories drop constraint if exists categories_family_id_type_name_key;
create unique index if not exists categories_family_type_name_uq
  on public.categories (family_id, type, name) where deleted_at is null;

drop index if exists public.movements_import_hash_uq;
create unique index if not exists movements_import_hash_uq
  on public.movements (family_id, import_hash) where import_hash is not null and deleted_at is null;

-- ---------- Log de conflitos (diagnóstico) ----------
create table if not exists public.sync_conflicts (
  id          bigint generated always as identity primary key,
  family_id   uuid not null references public.families(id) on delete cascade,
  table_name  text not null,
  row_id      uuid not null,
  base_xid    xid8,
  server_xid  xid8,
  pushed_by   uuid not null default auth.uid(),
  overwritten jsonb not null,               -- versão do servidor que foi sobrescrita
  created_at  timestamptz not null default now()
);
alter table public.sync_conflicts enable row level security;
drop policy if exists sync_conflicts_read on public.sync_conflicts;
create policy sync_conflicts_read on public.sync_conflicts for select to authenticated
  using (family_id in (select public.my_family_ids()));

-- Grava o log de conflito. sync_push roda como o usuário (RLS vale) e o app não tem
-- permissão de escrita em sync_conflicts; esta função é o único caminho de escrita.
create or replace function public.log_sync_conflict(
  p_family_id uuid, p_table text, p_row_id uuid, p_base xid8, p_server xid8, p_overwritten jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_family_member(p_family_id) then raise exception 'forbidden'; end if;
  insert into public.sync_conflicts (family_id, table_name, row_id, base_xid, server_xid, pushed_by, overwritten)
  values (p_family_id, p_table, p_row_id, p_base, p_server, auth.uid(), p_overwritten);
end $$;
revoke all on function public.log_sync_conflict(uuid, text, uuid, xid8, xid8, jsonb) from public, anon;
grant execute on function public.log_sync_conflict(uuid, text, uuid, xid8, xid8, jsonb) to authenticated;

-- ---------- PUSH ----------
-- p_changes: [{ "table": "movements", "row": {...colunas...}, "base_xid": "123" | null }]
-- Exclusão = row com deleted_at preenchido.
create or replace function public.sync_push(p_family_id uuid, p_changes jsonb)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  c           jsonb;
  v_table     text;
  v_row       jsonb;
  v_base      xid8;
  v_current   jsonb;
  v_cols      text;
  v_set       text;
  v_conflicts jsonb := '[]'::jsonb;
  v_applied   int := 0;
begin
  if not public.is_family_member(p_family_id) then raise exception 'forbidden'; end if;

  for c in select value from jsonb_array_elements(p_changes) loop
    v_table := c ->> 'table';
    if v_table not in ('categories', 'credit_cards', 'fixed_expenses', 'fixed_expense_payments', 'movements') then
      raise exception 'invalid_table: %', v_table;
    end if;

    -- family_id sempre vem do parâmetro: o cliente não consegue gravar em outra família
    v_row  := (c -> 'row') || jsonb_build_object('family_id', p_family_id);
    v_base := nullif(c ->> 'base_xid', '')::xid8;

    execute format('select to_jsonb(t) from public.%I t where id = $1 for update', v_table)
      into v_current using (v_row ->> 'id')::uuid;

    if v_current is not null and v_base is distinct from (v_current ->> 'change_xid')::xid8 then
      perform public.log_sync_conflict(p_family_id, v_table, (v_row ->> 'id')::uuid, v_base,
                                       (v_current ->> 'change_xid')::xid8, v_current);
      v_conflicts := v_conflicts || jsonb_build_object('table', v_table, 'id', v_row ->> 'id');
    end if;

    -- Só colunas reais e graváveis pelo cliente.
    -- created_by nunca vem do cliente: no insert o default é auth.uid() (exigido pela policy
    -- de INSERT, que o Postgres avalia mesmo quando o ON CONFLICT vira update); no update o
    -- trigger keep_created_by preserva o original.
    select string_agg(quote_ident(k), ', '),
           string_agg(format('%1$I = excluded.%1$I', k), ', ') filter (where k <> 'family_id')
      into v_cols, v_set
      from jsonb_object_keys(v_row) as k
     where k not in ('change_xid', 'updated_at', 'created_at', 'created_by')
       and exists (select 1 from information_schema.columns ic
                   where ic.table_schema = 'public' and ic.table_name = v_table and ic.column_name = k);

    execute format(
      'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1)
       on conflict (id) do update set %3$s',
      v_table, v_cols, v_set) using v_row;

    v_applied := v_applied + 1;
  end loop;

  -- xid desta transação = nova change_xid de todas as linhas aplicadas. O cliente grava
  -- como versão local, para a próxima edição não acusar conflito consigo mesma.
  return jsonb_build_object('applied', v_applied, 'conflicts', v_conflicts,
                            'xid', pg_current_xact_id()::text);
end $$;

-- ---------- PULL (paginado) ----------
-- Devolve as mudanças da família desde p_cursor (null = carga inicial), no máximo
-- p_limit linhas por chamada, percorrendo as tabelas na ordem das FKs e cada uma por
-- (change_xid, id). Enquanto has_more = true, o cliente chama de novo com o `page`
-- recebido. O cursor final (`cursor`) é fixado na PRIMEIRA página e só deve ser salvo
-- depois da última: linhas alteradas durante a paginação voltam no próximo pull.
-- Inclui linhas com deleted_at (tombstones). Família e membros vêm sempre completos.
drop function if exists public.sync_pull(uuid, text);

create or replace function public.sync_pull(
  p_family_id uuid,
  p_cursor    text  default null,
  p_limit     int   default 1000,
  p_page      jsonb default null
) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_tables  text[] := array['categories', 'credit_cards', 'fixed_expenses', 'fixed_expense_payments', 'movements'];
  v_from    xid8   := coalesce(nullif(p_cursor, '')::xid8, '0'::xid8);
  v_next    text   := coalesce(p_page ->> 'cursor', pg_snapshot_xmin(pg_current_snapshot())::text);
  v_idx     int    := coalesce((p_page ->> 't')::int, 1);
  v_last_x  xid8   := nullif(p_page ->> 'x', '')::xid8;
  v_last_id uuid   := nullif(p_page ->> 'id', '')::uuid;
  v_limit   int    := least(greatest(coalesce(p_limit, 1000), 1), 5000);
  v_left    int;
  v_result  jsonb  := '{}'::jsonb;
  v_rows    jsonb;
  v_count   int;
  v_page    jsonb  := null;
begin
  if not public.is_family_member(p_family_id) then raise exception 'forbidden'; end if;
  v_left := v_limit;

  for i in 1 .. array_length(v_tables, 1) loop
    if i < v_idx then
      v_result := v_result || jsonb_build_object(v_tables[i], '[]'::jsonb);
      continue;
    end if;
    if v_left <= 0 then
      v_result := v_result || jsonb_build_object(v_tables[i], '[]'::jsonb);
      continue;
    end if;

    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x) - ''change_xid'' || jsonb_build_object(''change_xid'', x.change_xid::text)
                                 order by x.change_xid, x.id), ''[]''), count(*)
         from (select * from public.%I t
                where t.family_id = $1 and t.change_xid >= $2
                  and ($3::xid8 is null or (t.change_xid, t.id) > ($3::xid8, $4::uuid))
                order by t.change_xid, t.id
                limit $5) x', v_tables[i])
      into v_rows, v_count
      using p_family_id, v_from, case when i = v_idx then v_last_x end, case when i = v_idx then v_last_id end, v_left;

    v_result := v_result || jsonb_build_object(v_tables[i], v_rows);
    v_left := v_left - v_count;

    if v_left <= 0 then
      -- Página cheia: retoma desta tabela, depois da última linha devolvida
      v_page := jsonb_build_object('cursor', v_next, 't', i,
                                   'x', v_rows -> -1 ->> 'change_xid', 'id', v_rows -> -1 ->> 'id');
    end if;
  end loop;

  v_result := v_result || jsonb_build_object(
    'family',  (select to_jsonb(f) from public.families f where f.id = p_family_id),
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
                   'user_id', fm.user_id, 'role', fm.role, 'active', fm.active,
                   'name', pr.name, 'avatar_url', pr.avatar_url)), '[]')
                from public.family_members fm join public.profiles pr on pr.id = fm.user_id
                where fm.family_id = p_family_id));

  return jsonb_build_object('cursor', v_next, 'changes', v_result,
                            'has_more', v_page is not null, 'page', v_page);
end $$;

grant execute on function public.sync_push(uuid, jsonb)            to authenticated;
grant execute on function public.sync_pull(uuid, text, int, jsonb) to authenticated;

-- >>>>>>>>>> 20261107000004_device_link.sql
-- =====================================================================
-- MyFinances · 004_device_link.sql
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
drop policy if exists device_pairings_read on public.device_pairings;
create policy device_pairings_read on public.device_pairings for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists user_devices_read on public.user_devices;
create policy user_devices_read on public.user_devices for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.device_pairings from authenticated;
revoke insert, update, delete on public.user_devices    from authenticated;

do $$
declare t text;
begin
  foreach t in array array['device_pairings'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

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

-- >>>>>>>>>> 20261107000005_dashboard.sql
-- =====================================================================
-- MyFinances · 005_dashboard.sql
-- Especificação de referência: o app calcula os mesmos totais no SQLite local.
-- Agregações do dashboard. SECURITY INVOKER: o RLS de movements continua
-- valendo, então a função nunca devolve dados de família alheia.
--
-- p_member_id NULL = visão consolidada da família.
--
-- Regra das TRANSFERÊNCIAS (type = 'TRANSFER', member_id -> to_member_id):
--   * Visão família: ignoradas (o dinheiro não saiu da família).
--   * Visão de um membro: saída para quem envia, entrada para quem recebe.
--     Aparecem em transferOut/transferIn e entram no saldo, mas NÃO somam em
--     monthIncome/monthExpense nem nos gráficos por categoria/cartão.
-- =====================================================================

create or replace function public.dashboard_summary(
  p_family_id uuid,
  p_start     date,
  p_end       date,
  p_member_id uuid default null
) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with scoped as (
    -- Valor assinado do ponto de vista da visão escolhida
    select m.*,
           case
             when m.type = 'INCOME'  then  m.amount
             when m.type = 'EXPENSE' then -m.amount
             when p_member_id is null then 0                         -- transferência interna à família
             when m.member_id    = p_member_id then -m.amount        -- enviou
             when m.to_member_id = p_member_id then  m.amount        -- recebeu
             else 0
           end as signed_amount
    from public.movements m
    where m.family_id = p_family_id and m.deleted_at is null
      and (p_member_id is null
           or m.member_id = p_member_id
           or (m.type = 'TRANSFER' and m.to_member_id = p_member_id))
  ),
  period as (
    select * from scoped where date between p_start and p_end
  )
  select jsonb_build_object(
    'totalBalance', coalesce((select sum(signed_amount) from scoped where date <= p_end), 0),
    'monthIncome',  coalesce((select sum(amount) from period where type = 'INCOME'), 0),
    'monthExpense', coalesce((select sum(amount) from period where type = 'EXPENSE'), 0),
    'transferIn',   coalesce((select sum(signed_amount) from period where type = 'TRANSFER' and signed_amount > 0), 0),
    'transferOut',  coalesce((select -sum(signed_amount) from period where type = 'TRANSFER' and signed_amount < 0), 0),
    'expensesByCategory', coalesce((
      select jsonb_agg(x order by x.value desc) from (
        select c.id, c.name as label, coalesce(c.color, '#94a3b8') as color, sum(p.amount) as value
        from period p join public.categories c on c.family_id = p.family_id and c.id = p.category_id
        where p.type = 'EXPENSE'
        group by c.id, c.name, c.color) x), '[]'::jsonb),
    'expensesByCard', coalesce((
      select jsonb_agg(x order by x.value desc) from (
        select cc.id, cc.description as label, cc.color, sum(p.amount) as value
        from period p join public.credit_cards cc on cc.family_id = p.family_id and cc.id = p.credit_card_id
        where p.type = 'EXPENSE'
        group by cc.id, cc.description, cc.color) x), '[]'::jsonb),
    -- Receita x despesa de cada membro no período (sempre da família toda, sem transferências)
    'byMember', coalesce((
      select jsonb_agg(x order by x.expense desc) from (
        select mv.member_id, pr.name,
               sum(case when mv.type = 'INCOME'  then mv.amount else 0 end) as income,
               sum(case when mv.type = 'EXPENSE' then mv.amount else 0 end) as expense
        from public.movements mv join public.profiles pr on pr.id = mv.member_id
        where mv.family_id = p_family_id and mv.type <> 'TRANSFER' and mv.deleted_at is null
          and mv.date between p_start and p_end
        group by mv.member_id, pr.name) x), '[]'::jsonb)
  );
$$;

-- Histórico mensal (substitui o loop de 5 queries do dashboard.ipc.ts).
-- Transferências não entram em receita/despesa (aparecem só no saldo do membro).
create or replace function public.monthly_history(
  p_family_id uuid,
  p_ref       date,
  p_months    int default 5,
  p_member_id uuid default null
) returns table (year_month text, income numeric, expense numeric)
language sql stable security invoker set search_path = '' as $$
  with months as (
    select generate_series(
      date_trunc('month', p_ref) - make_interval(months => p_months - 1),
      date_trunc('month', p_ref),
      interval '1 month')::date as m
  )
  select to_char(months.m, 'YYYY-MM'),
         coalesce(sum(mv.amount) filter (where mv.type = 'INCOME'), 0),
         coalesce(sum(mv.amount) filter (where mv.type = 'EXPENSE'), 0)
  from months
  left join public.movements mv
    on mv.family_id = p_family_id
   and mv.deleted_at is null
   and mv.type <> 'TRANSFER'
   and mv.date >= months.m and mv.date < (months.m + interval '1 month')
   and (p_member_id is null or mv.member_id = p_member_id)
  group by months.m
  order by months.m;
$$;

grant execute on function public.dashboard_summary(uuid, date, date, uuid) to authenticated;
grant execute on function public.monthly_history(uuid, date, int, uuid)    to authenticated;

-- >>>>>>>>>> 20261107000006_hardening.sql
-- =====================================================================
-- MyFinances · 006_hardening.sql
-- Roda por último. O Supabase dá privilégios ao anon e ao PUBLIC em toda
-- tabela e função nova do schema public (default privileges). Aqui isso é
-- desfeito: sem login, a publishable key só consegue ler a versão do schema.
-- =====================================================================

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon, public;

alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon, public;

-- Única exceção: a tela de conexão valida o schema antes do login.
grant execute on function public.app_schema_version() to anon, authenticated;
-- revoke de PUBLIC acima não tira o grant explícito feito na 003
grant execute on function public.log_sync_conflict(uuid, text, uuid, xid8, xid8, jsonb) to authenticated;

-- Tabelas de controle não são editáveis pelo app.
revoke insert, update, delete on public.app_meta       from authenticated;
revoke insert, update, delete on public.sync_conflicts from authenticated;

commit;
