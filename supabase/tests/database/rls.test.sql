-- =====================================================================
-- Testes de RLS e regras de integridade (pgTAP · yarn db:test)
--
-- Usuários:  Ana (OWNER da Família 1) · Beto (MEMBER da Família 1)
--            Caio (OWNER da Família 2) · Duda (sem família, aceita convites)
-- Cada bloco troca de usuário com tests.login() e volta com tests.logout().
-- Nada usa service_role: as consultas passam pelo mesmo caminho do app.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------- Helpers ----------
create schema if not exists tests;

create or replace function tests.login(p_user uuid, p_session uuid default null) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', p_user, 'role', 'authenticated',
    'session_id', coalesce(p_session, '00000000-0000-0000-0000-0000000000ff'))::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.logout() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;

grant usage on schema tests to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

-- ---------- Massa de dados (como postgres) ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-00000000000a', 'ana@test.local',  '{"name":"Ana"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'beto@test.local', '{"name":"Beto"}'),
  ('c0000000-0000-0000-0000-00000000000c', 'caio@test.local', '{"name":"Caio"}'),
  ('d0000000-0000-0000-0000-00000000000d', 'duda@test.local', '{"name":"Duda"}');

insert into public.families (id, name, created_by) values
  ('f1000000-0000-0000-0000-000000000001', 'Família 1', 'a0000000-0000-0000-0000-00000000000a'),
  ('f2000000-0000-0000-0000-000000000002', 'Família 2', 'c0000000-0000-0000-0000-00000000000c');

insert into public.family_members (family_id, user_id, role) values
  ('f1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'OWNER'),
  ('f1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'MEMBER'),
  ('f2000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000c', 'OWNER');

insert into public.categories (id, family_id, name, type) values
  ('ca100000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'Mercado', 'EXPENSE'),
  ('ca200000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002', 'Mercado', 'EXPENSE');

insert into public.movements (id, family_id, member_id, created_by, description, amount, date, type, category_id) values
  ('a1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'Compra Ana', 100, '2026-11-01', 'EXPENSE',
   'ca100000-0000-0000-0000-000000000001'),
  ('a2000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-00000000000c', 'Compra Caio', 50, '2026-11-01', 'EXPENSE',
   'ca200000-0000-0000-0000-000000000002');

-- =====================================================================
-- 1. Isolamento entre famílias
-- =====================================================================
select tests.login('b0000000-0000-0000-0000-00000000000b'); -- Beto, Família 1

select results_eq('select count(*)::int from public.movements', array[1],
  'membro só enxerga os lançamentos da própria família');
select results_eq('select count(*)::int from public.categories', array[1],
  'membro só enxerga as categorias da própria família');
select results_eq('select count(*)::int from public.families', array[1],
  'membro só enxerga a própria família');
select results_eq('select count(*)::int from public.profiles', array[2],
  'membro enxerga o próprio perfil e o de quem divide família com ele');

select throws_ok(
  $$insert into public.movements (family_id, member_id, description, amount, date, type)
    values ('f2000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000b', 'x', 1, '2026-11-01', 'EXPENSE')$$,
  '42501', null, 'não insere lançamento em outra família');

select lives_ok(
  $$update public.movements set description = 'invadido' where id = 'a2000000-0000-0000-0000-000000000002'$$,
  'update em lançamento de outra família não dá erro, mas...');

select throws_ok(
  $$insert into public.categories (family_id, name, type) values ('f2000000-0000-0000-0000-000000000002', 'x', 'EXPENSE')$$,
  '42501', null, 'não cria categoria em outra família');
select tests.logout();
select results_eq(
  $$select description from public.movements where id = 'a2000000-0000-0000-0000-000000000002'$$,
  array['Compra Caio'], '...o lançamento da outra família continua igual');
select tests.login('b0000000-0000-0000-0000-00000000000b');

-- =====================================================================
-- 2. Todos editam tudo, created_by preservado
-- =====================================================================
select lives_ok(
  $$update public.movements set description = 'Editado pelo Beto', created_by = 'b0000000-0000-0000-0000-00000000000b'
    where id = 'a1000000-0000-0000-0000-000000000001'$$,
  'membro edita lançamento de outro membro');
select results_eq(
  $$select description, created_by from public.movements where id = 'a1000000-0000-0000-0000-000000000001'$$,
  $$values ('Editado pelo Beto'::text, 'a0000000-0000-0000-0000-00000000000a'::uuid)$$,
  'created_by continua com quem lançou');

select throws_ok(
  $$insert into public.movements (family_id, member_id, created_by, description, amount, date, type)
    values ('f1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b',
            'a0000000-0000-0000-0000-00000000000a', 'forjado', 1, '2026-11-01', 'EXPENSE')$$,
  '42501', null, 'não insere com created_by de outra pessoa');

select throws_ok(
  $$delete from public.movements where id = 'a1000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'exclusão física é proibida (só soft delete)');

-- =====================================================================
-- 3. Integridade: transferências e FKs compostas
-- =====================================================================
select throws_ok(
  $$insert into public.movements (family_id, member_id, description, amount, date, type)
    values ('f1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 't', 1, '2026-11-01', 'TRANSFER')$$,
  '23514', null, 'transferência sem destinatário é recusada');
select throws_ok(
  $$insert into public.movements (family_id, member_id, to_member_id, description, amount, date, type)
    values ('f1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b',
            'b0000000-0000-0000-0000-00000000000b', 't', 1, '2026-11-01', 'TRANSFER')$$,
  '23514', null, 'transferência para si mesmo é recusada');
select throws_ok(
  $$insert into public.movements (family_id, member_id, to_member_id, description, amount, date, type, category_id)
    values ('f1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b',
            'a0000000-0000-0000-0000-00000000000a', 't', 1, '2026-11-01', 'TRANSFER', 'ca100000-0000-0000-0000-000000000001')$$,
  '23514', null, 'transferência com categoria é recusada');
select throws_ok(
  $$insert into public.movements (family_id, member_id, to_member_id, description, amount, date, type)
    values ('f1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b',
            'a0000000-0000-0000-0000-00000000000a', 'r', 1, '2026-11-01', 'EXPENSE')$$,
  '23514', null, 'receita/despesa com destinatário é recusada');
select lives_ok(
  $$insert into public.movements (family_id, member_id, to_member_id, description, amount, date, type)
    values ('f1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b',
            'a0000000-0000-0000-0000-00000000000a', 'Mesada', 20, '2026-11-02', 'TRANSFER')$$,
  'transferência válida entre membros é aceita');

select throws_ok(
  $$insert into public.movements (family_id, member_id, description, amount, date, type, category_id)
    values ('f1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'x', 1, '2026-11-01', 'EXPENSE',
            'ca200000-0000-0000-0000-000000000002')$$,
  '23503', null, 'FK composta impede usar categoria de outra família');
select throws_ok(
  $$insert into public.movements (family_id, member_id, description, amount, date, type)
    values ('f1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c', 'x', 1, '2026-11-01', 'EXPENSE')$$,
  '23503', null, 'FK composta impede lançar em nome de quem não é da família');

-- =====================================================================
-- 4. Permissões de administração
-- =====================================================================
select throws_ok(
  $$select public.create_family_invite('f1000000-0000-0000-0000-000000000001')$$,
  'P0001', 'forbidden', 'MEMBER não cria convite');
select throws_ok(
  $$select public.set_member_active('f1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', false)$$,
  'P0001', 'forbidden', 'MEMBER não desativa membro');
select is(
  (public.create_device_link('f1000000-0000-0000-0000-000000000001') ->> 'invite_token'), null::text,
  'QR gerado por MEMBER não traz convite');
select throws_ok(
  $$select public.create_device_link('f2000000-0000-0000-0000-000000000002')$$,
  'P0001', 'forbidden', 'não gera QR para família alheia');
select tests.logout();

select tests.login('a0000000-0000-0000-0000-00000000000a'); -- Ana, OWNER
select lives_ok(
  $$select public.set_member_active('f1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', false)$$,
  'OWNER desativa membro');
select tests.logout();

select tests.login('b0000000-0000-0000-0000-00000000000b');
select results_eq('select count(*)::int from public.movements', array[0],
  'membro desativado perde o acesso aos dados');
select tests.logout();

select tests.login('a0000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$select public.set_member_active('f1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', true)$$,
  'OWNER reativa membro');
select isnt(
  (public.create_device_link('f1000000-0000-0000-0000-000000000001') ->> 'invite_token'), null::text,
  'QR gerado por OWNER traz convite');
select set_config('tests.invite', public.create_family_invite('f1000000-0000-0000-0000-000000000001'), true);
select tests.logout();

-- =====================================================================
-- 5. Convites
-- =====================================================================
select tests.login('d0000000-0000-0000-0000-00000000000d'); -- Duda, sem família
select results_eq('select count(*)::int from public.families', array[0], 'sem família não vê nenhuma família');
select results_eq(
  $$select public.accept_family_invite(current_setting('tests.invite'))$$,
  $$values ('f1000000-0000-0000-0000-000000000001'::uuid)$$,
  'convite válido coloca o usuário na família');
select results_eq('select count(*)::int from public.families', array[1], 'novo membro passa a ver a família');
select throws_ok(
  $$select public.accept_family_invite(current_setting('tests.invite'))$$,
  'P0001', 'invalid_or_expired_invite', 'convite já usado é recusado');
select tests.logout();

insert into public.family_invites (family_id, token_hash, created_by, expires_at)
values ('f2000000-0000-0000-0000-000000000002', encode(extensions.digest('token-expirado', 'sha256'), 'hex'),
        'c0000000-0000-0000-0000-00000000000c', now() - interval '1 minute');

select tests.login('d0000000-0000-0000-0000-00000000000d');
select throws_ok(
  $$select public.accept_family_invite('token-expirado')$$,
  'P0001', 'invalid_or_expired_invite', 'convite expirado é recusado');
select tests.logout();

-- =====================================================================
-- 6. Pareamento de aparelho e aparelhos conectados
-- =====================================================================
insert into public.device_pairings (id, user_id, family_id, token_hash, status, device_name) values
  ('dd000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
   'f1000000-0000-0000-0000-000000000001', 'hash-pareamento-ana', 'WAITING_APPROVAL', 'Moto G');
insert into auth.sessions (id, user_id) values
  ('5e000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a');
insert into public.user_devices (id, user_id, session_id, device_name, platform) values
  ('de000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a',
   '5e000000-0000-0000-0000-00000000000a', 'Moto G', 'android');

select tests.login('b0000000-0000-0000-0000-00000000000b');
select results_eq(
  $$select count(*)::int from public.device_pairings where id = 'dd000000-0000-0000-0000-000000000001'$$,
  array[0], 'não lê o pareamento de outro usuário');
select throws_ok(
  $$select public.resolve_device_pairing('dd000000-0000-0000-0000-000000000001', true)$$,
  'P0001', 'pairing_not_pending', 'não aprova o pareamento de outro usuário');
select throws_ok(
  $$select public.revoke_device('de000000-0000-0000-0000-00000000000a')$$,
  'P0001', 'device_not_found', 'não desconecta aparelho de outro usuário');
select throws_ok(
  $$insert into public.device_pairings (family_id, token_hash) values ('f1000000-0000-0000-0000-000000000001', 'x')$$,
  '42501', null, 'pareamento só é criado por RPC');
select tests.logout();

select ok(exists (select 1 from auth.sessions where id = '5e000000-0000-0000-0000-00000000000a'),
  'a sessão da Ana continua intacta');

select tests.login('a0000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$select public.resolve_device_pairing('dd000000-0000-0000-0000-000000000001', true)$$,
  'dono aprova o próprio pareamento');
select results_eq(
  $$select status::text from public.device_pairings where id = 'dd000000-0000-0000-0000-000000000001'$$,
  array['APPROVED'], 'pareamento fica APPROVED');
select lives_ok(
  $$select public.revoke_device('de000000-0000-0000-0000-00000000000a')$$,
  'dono desconecta o próprio aparelho');
select tests.logout();

select ok(not exists (select 1 from auth.sessions where id = '5e000000-0000-0000-0000-00000000000a'),
  'desconectar apaga a sessão no Auth');

select tests.login('b0000000-0000-0000-0000-00000000000b', '5e000000-0000-0000-0000-00000000000b');
select lives_ok($$select public.register_device('Notebook do Beto', 'desktop')$$, 'aparelho se registra');
select results_eq(
  $$select device_name from public.user_devices where session_id = '5e000000-0000-0000-0000-00000000000b'$$,
  array['Notebook do Beto'], 'registro usa o session_id do JWT');
select tests.logout();

-- =====================================================================
-- 7. Sincronização (push/pull respeitam a família)
-- =====================================================================
select tests.login('b0000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$select public.sync_push('f2000000-0000-0000-0000-000000000002',
     '[{"table":"categories","row":{"id":"ca300000-0000-0000-0000-000000000003","name":"x","type":"EXPENSE"}}]')$$,
  'P0001', 'forbidden', 'push para família alheia é recusado');
select lives_ok(
  $$select public.sync_push('f1000000-0000-0000-0000-000000000001',
     '[{"table":"categories","row":{"id":"ca400000-0000-0000-0000-000000000004","family_id":"f2000000-0000-0000-0000-000000000002","name":"Farmácia","type":"EXPENSE"}}]')$$,
  'push com family_id forjado no payload é aceito...');
select results_eq(
  $$select family_id from public.categories where id = 'ca400000-0000-0000-0000-000000000004'$$,
  $$values ('f1000000-0000-0000-0000-000000000001'::uuid)$$,
  '...mas grava na família do parâmetro');
select throws_ok(
  $$select public.sync_push('f1000000-0000-0000-0000-000000000001', '[{"table":"family_members","row":{}}]')$$,
  'P0001', null, 'push só aceita tabelas da whitelist');
select ok(
  (public.sync_pull('f1000000-0000-0000-0000-000000000001') -> 'changes' -> 'movements') @> '[{"description":"Mesada"}]'
  and not ((public.sync_pull('f1000000-0000-0000-0000-000000000001') -> 'changes' -> 'movements') @> '[{"description":"Compra Caio"}]'),
  'pull traz só os lançamentos da família');
select throws_ok(
  $$select public.sync_pull('f2000000-0000-0000-0000-000000000002')$$,
  'P0001', 'forbidden', 'pull de família alheia é recusado');
select tests.logout();

-- =====================================================================
-- 8. Anônimo (só a publishable key, sem login)
-- =====================================================================
select is(
  (select count(*)::int from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public'),
  0, 'anon não tem nenhum privilégio em tabela');
select ok(has_function_privilege('anon', 'public.app_schema_version()', 'execute'),
  'anon consulta a versão do schema');
select ok(not has_function_privilege('anon', 'public.sync_pull(uuid, text)', 'execute'),
  'anon não executa sync_pull');
select ok(not has_function_privilege('anon', 'public.accept_family_invite(text)', 'execute'),
  'anon não aceita convite');

set local role anon;
select set_config('tests.anon_version', public.app_schema_version()::text, true);
reset role;
select is(current_setting('tests.anon_version'), '1', 'anon lê a versão do schema antes do login');
select ok(not has_table_privilege('anon', 'public.movements', 'select'), 'anon não lê lançamentos');

select * from finish();
rollback;
