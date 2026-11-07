-- =====================================================================
-- MyFinances · 001_schema.sql  (RASCUNHO — validar na Etapa 1)
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
