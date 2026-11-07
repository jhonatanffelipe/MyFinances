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
