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
