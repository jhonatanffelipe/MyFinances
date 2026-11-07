---
tags:
  - myfinances
  - plano/v2
  - etapa
aliases:
  - "Etapa 1"
  - "Fundação Supabase"
etapa: 1
status: pendente
plano: "[[README|Plano v2.0.0]]"
depende_de: []
---
# Etapa 1 — Fundação Supabase

**Objetivo:** ter o banco Postgres pronto, versionado e com isolamento por família
**provado por teste**, antes de tocar em qualquer tela.

## Tarefas

- [ ] Criar `supabase/` na raiz do repo (`npx supabase init`) para versionar as migrações.
- [ ] Subir o stack local com Docker (`npx supabase start`): Postgres, Auth, PostgREST e Studio.
- [ ] Mover os rascunhos de `sql/` para `supabase/migrations/` com timestamp:
  - `..._001_schema.sql`: tabelas, tipos, índices e triggers
  - `..._002_rls.sql`: RLS, helpers e RPCs de família
  - `..._003_rpc.sql`: agregações do dashboard (especificação de referência; o app calcula
    no SQLite local)
  - `..._004_sync.sql`: colunas de sync, `sync_push` e `sync_pull` (detalhados na Etapa 3)
  - `..._005_device_link.sql`: pareamento por QR e aparelhos conectados (Etapa 5)
- [ ] Mover [[functions/pair-device/index.ts|functions/pair-device]] para
  `supabase/functions/` e servir localmente com `npx supabase functions serve`.
- [ ] Gerar **um único `setup.sql` concatenado e idempotente** (script `yarn db:bundle`) para o
  usuário final colar no SQL Editor. Ele é o artefato que acompanha cada release.
- [ ] Regra de versionamento: cada migração nova incrementa `app_meta.schema_version`. O app
  declara `MIN_SCHEMA_VERSION` e bloqueia com instrução quando o banco estiver atrás.
- [ ] Gerar tipos TypeScript do banco: `npx supabase gen types typescript --local > packages/core/src/db/database.types.ts`.
- [ ] **Testes de RLS** (pgTAP via `supabase test db`, ou script Node com dois clientes):
  - usuário A (família 1) não lê, não insere e não altera nada da família 2;
  - qualquer membro edita lançamento de outro membro, mas `created_by` continua o original;
  - transferência sem `to_member_id`, para si mesmo ou com categoria é recusada pela constraint;
  - Realtime: um usuário de outra família não recebe eventos de `movements` desta;
  - MEMBER não cria convite nem desativa membro (só OWNER/ADMIN);
  - um usuário não lê nem aprova o `device_pairings` de outro; `revoke_device` não apaga
    sessão de outro usuário;
  - anon não lê nenhuma tabela, só `app_schema_version()`;
  - convite expirado ou já usado é recusado, e o uso concorrente do mesmo convite falha em um dos lados;
  - FK composta impede `movements.category_id` de outra família.
- [ ] Rodar `EXPLAIN ANALYZE` das consultas principais com uns 50 mil lançamentos fake e
  conferir que usam `movements_family_date_idx` e que o `is_family_member()` não vira gargalo
  (a chamada com `(select auth.uid())` é cacheada por statement).

## Pontos de atenção

- `ON DELETE SET NULL (coluna)` exige PG15+. O Supabase atual já está acima disso.
- `pgcrypto` fica no schema `extensions` no Supabase, por isso as funções o referenciam como
  `extensions.digest`.
- Nunca usar `service_role` nos testes de RLS: o teste precisa passar pelo mesmo caminho do app.

## Pronto quando

- `supabase db reset` aplica tudo do zero sem erro.
- A suíte de RLS passa.
- O `setup.sql` roda num projeto Supabase **novo na nuvem** pelo SQL Editor sem ajustes.

---

[[README|Plano v2.0.0]] · [[etapa-02-pacote-core|Etapa 2 →]]
