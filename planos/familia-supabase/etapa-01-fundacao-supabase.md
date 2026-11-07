---
tags:
  - myfinances
  - plano/v2
  - etapa
aliases:
  - "Etapa 1"
  - "Fundação Supabase"
etapa: 1
status: concluída
plano: "[[README|Plano v2.0.0]]"
depende_de: []
---
# Etapa 1 — Fundação Supabase

**Objetivo:** ter o banco Postgres pronto, versionado e com isolamento por família
**provado por teste**, antes de tocar em qualquer tela.

## Tarefas

- [x] Criar `supabase/` na raiz do repo (`supabase init`) e `package.json` raiz com a CLI do
  Supabase como devDependency.
- [x] Subir o stack local com Docker (`yarn db:start`): Postgres 17, Auth, PostgREST, Realtime,
  Edge Runtime e Studio (http://127.0.0.1:54323).
- [x] Mover os rascunhos para `supabase/migrations/`, nesta ordem:
  - `20261107000001_schema.sql`: tabelas, tipos, índices e triggers
  - `20261107000002_rls.sql`: RLS, helpers (`is_family_member`, `is_family_admin`,
    `my_family_ids`) e RPCs de família
  - `20261107000003_sync.sql`: colunas de sync, `sync_push` e `sync_pull` (Etapa 3)
  - `20261107000004_device_link.sql`: pareamento por QR e aparelhos conectados (Etapa 5)
  - `20261107000005_dashboard.sql`: totais do dashboard, como especificação de referência.
    Veio depois do sync porque filtra `deleted_at`.
  - `20261107000006_hardening.sql`: tira do `anon` e do `PUBLIC` os privilégios que o
    Supabase concede por padrão
- [x] Deixar as migrações idempotentes: `drop policy if exists` antes de cada policy e
  inclusão condicional na publicação do Realtime.
- [x] Mover a Edge Function para `supabase/functions/pair-device/` (`verify_jwt = false` no
  `config.toml`) e servir com `yarn functions:serve`.
- [x] Gerar `supabase/setup.sql` com `yarn db:bundle` (todas as migrações numa transação).
  Validado: roda duas vezes seguidas sem erro e, sozinho num banco zerado, passa em todos os
  testes.
- [x] Gerar os tipos: `yarn db:types` → `packages/core/src/db/database.types.ts`.
- [x] **Testes de RLS** em pgTAP (`yarn db:test`, 55 asserções em
  `supabase/tests/database/rls.test.sql`):
  - isolamento entre famílias (ler, inserir, alterar);
  - qualquer membro edita lançamento de outro, `created_by` preservado e não forjável;
  - exclusão física proibida (só soft delete);
  - constraints de transferência e FKs compostas (categoria e membro de outra família);
  - só OWNER/ADMIN cria convite, desativa membro e recebe convite no QR;
  - membro desativado perde o acesso;
  - convite válido, já usado e expirado;
  - pareamento e `revoke_device` só do próprio usuário; `register_device` usa o `session_id`;
  - `sync_push`/`sync_pull` presos à família do parâmetro, com whitelist de tabelas;
  - anon sem privilégio em tabela, só com `app_schema_version()`.
  Prova de que os testes pegam falha: com o RLS de `movements` desligado, 5 deles quebram.
- [x] **Teste de ponta a ponta do QR** (`yarn db:test:e2e`, com `functions:serve` rodando):
  cadastro, `create_device_link`, `scan` atômico, aprovação, `generateLink` + `verifyOtp`
  com sessão própria do celular, `register_device` e `revoke_device`.
- [x] `EXPLAIN ANALYZE` com 10 famílias × 50 mil lançamentos (ver resultados abaixo).
- [ ] Teste de Realtime (outra família não recebe eventos): fica para a Etapa 3, que traz o
  `supabase-js` e o canal Realtime.
- [ ] Uso **concorrente** do mesmo convite: precisa de duas conexões; o `FOR UPDATE` +
  `used_at` cobre o caso. Fica para a Etapa 5.
- [x] Rodar o `setup.sql` num projeto Supabase **novo na nuvem** pelo SQL Editor: "Success",
  sem ajustes (2026-11-07).

## Resultados

### Validações que estavam pendentes no plano

| Item | Resultado |
|---|---|
| `generateLink` + `verifyOtp({ token_hash, type: 'email' })` | Funciona e cria uma sessão nova, diferente da do computador |
| Claim `session_id` no JWT | Presente |
| Apagar a linha em `auth.sessions` derruba o refresh | Sim; a sessão do computador continua válida |
| `ON DELETE SET NULL (coluna)` | Funciona no Postgres 17 do Supabase |

### Desempenho (500 mil lançamentos, 50 mil na família consultada)

As policies usavam `is_family_member(family_id)`, chamada linha a linha. Trocadas por
`family_id in (select public.my_family_ids())`, que o Postgres calcula uma vez por consulta:

| Consulta | Antes | Depois |
|---|---|---|
| Lançamentos do mês (`movements_family_date_idx`) | 3,5 ms | 0,5 ms |
| `dashboard_summary` | 249 ms | 40 ms |
| `sync_pull` incremental sem mudanças | 1,4 ms | 2,5 ms |
| `sync_pull` carga inicial (50 mil linhas) | 1.063 ms | ~700 ms |

A carga inicial ainda é lenta porque monta um JSON com 50 mil linhas: a paginação do
`sync_pull` entra na Etapa 3.

## Pontos de atenção

- `ON DELETE SET NULL (coluna)` exige PG15+. O Supabase usa o 17.
- Policy nova de membro: usar `family_id in (select public.my_family_ids())`, nunca
  `is_family_member(family_id)`, que é avaliada linha a linha.
- Toda tabela ou função nova em `public` precisa passar pelo `006_hardening.sql` (ou
  repetir os `revoke` na própria migração).
- `pgcrypto` fica no schema `extensions` no Supabase, por isso as funções o referenciam como
  `extensions.digest`.
- Nunca usar `service_role` nos testes de RLS: o teste precisa passar pelo mesmo caminho do app.

## Pronto quando

- `supabase db reset` aplica tudo do zero sem erro.
- A suíte de RLS passa.
- O `setup.sql` roda num projeto Supabase **novo na nuvem** pelo SQL Editor sem ajustes.

---

[[README|Plano v2.0.0]] · [[etapa-02-pacote-core|Etapa 2 →]]
