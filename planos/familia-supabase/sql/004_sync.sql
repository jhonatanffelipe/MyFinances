-- =====================================================================
-- MyFinances · 004_sync.sql  (RASCUNHO — validar na Etapa 3)
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
create policy sync_conflicts_read on public.sync_conflicts for select to authenticated
  using (public.is_family_member(family_id));

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
      insert into public.sync_conflicts (family_id, table_name, row_id, base_xid, server_xid, overwritten)
      values (p_family_id, v_table, (v_row ->> 'id')::uuid, v_base, (v_current ->> 'change_xid')::xid8, v_current);
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

  return jsonb_build_object('applied', v_applied, 'conflicts', v_conflicts);
end $$;

-- ---------- PULL ----------
-- Devolve as mudanças da família desde p_cursor (null = carga inicial) e o novo cursor.
-- Inclui linhas com deleted_at (tombstones). Membros/perfis/família vêm sempre completos
-- (são poucas linhas) para o app funcionar offline com nomes atualizados.
create or replace function public.sync_pull(p_family_id uuid, p_cursor text default null)
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_from   xid8 := coalesce(nullif(p_cursor, '')::xid8, '0'::xid8);
  v_next   xid8 := pg_snapshot_xmin(pg_current_snapshot());
  v_result jsonb := '{}'::jsonb;
  t        text;
  v_rows   jsonb;
begin
  if not public.is_family_member(p_family_id) then raise exception 'forbidden'; end if;

  foreach t in array array['categories', 'credit_cards', 'fixed_expenses', 'fixed_expense_payments', 'movements'] loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x) - ''change_xid'' || jsonb_build_object(''change_xid'', x.change_xid::text)), ''[]'')
         from public.%I x where x.family_id = $1 and x.change_xid >= $2', t)
      into v_rows using p_family_id, v_from;
    v_result := v_result || jsonb_build_object(t, v_rows);
  end loop;

  v_result := v_result || jsonb_build_object(
    'family',  (select to_jsonb(f) from public.families f where f.id = p_family_id),
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
                   'user_id', fm.user_id, 'role', fm.role, 'active', fm.active,
                   'name', pr.name, 'avatar_url', pr.avatar_url)), '[]')
                from public.family_members fm join public.profiles pr on pr.id = fm.user_id
                where fm.family_id = p_family_id));

  return jsonb_build_object('cursor', v_next::text, 'changes', v_result);
end $$;

grant execute on function public.sync_push(uuid, jsonb) to authenticated;
grant execute on function public.sync_pull(uuid, text)  to authenticated;

-- TODO Etapa 3: paginar o pull (carga inicial grande) — limitar por tabela e
-- devolver "has_more"; o cursor só avança quando todas as páginas chegarem.
