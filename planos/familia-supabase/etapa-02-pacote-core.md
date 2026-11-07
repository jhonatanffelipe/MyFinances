---
tags:
  - myfinances
  - plano/v2
  - etapa
aliases:
  - "Etapa 2"
  - "Pacote core compartilhado"
etapa: 2
status: pendente
plano: "[[README|Plano v2.0.0]]"
depende_de:
  - "[[etapa-01-fundacao-supabase]]"
---
# Etapa 2 — Pacote `core` compartilhado (local-first)

**Objetivo:** uma única implementação de regras de negócio e acesso a dados, usada pelo
desktop e pelo mobile, **sobre o SQLite local**. Isso acaba com a duplicação atual
(`desktop/electron/ipc/*.ipc.ts` com SQL inline × `mobile/src/data/repositories/*.ts`).

## Ponto de partida: reaproveitar o mobile

O mobile já tem o desenho certo: repositórios SQL que dependem só da interface `DbAdapter`
(`mobile/src/data/adapter.ts`), com implementação para expo-sqlite (app) e sql.js (testes).
Esses repositórios **sobem para o core** e passam a servir os dois apps. O desktop ganha um
`DbAdapter` sobre o sql.js que ele já usa.

## Estrutura proposta

```
package.json                 # raiz: yarn workspaces ["desktop", "mobile", "packages/*"]
packages/core/
  src/
    domain/                  # entidades e tipos (Movement, Category, Family, Money...)
    db/
      adapter.ts             # DbAdapter (vindo do mobile)
      migrations/            # schema LOCAL versionado (PRAGMA user_version)
    repositories/            # interfaces + implementações SQL (escrevem também no _outbox)
    sync/                    # SyncEngine, outbox, cursor (Etapa 3)
    remote/                  # client Supabase: auth, RPCs de família, sync_push/pull
    use-cases/               # CreateMovement, ImportMovements, GetDashboard, AcceptInvite...
    connection/              # código de conexão, MIN_SCHEMA_VERSION
    errors/AppError.ts       # NOT_MEMBER, SCHEMA_OUTDATED, PROJECT_PAUSED, OFFLINE...
  tests/                     # roda com sql.js (já existe tests/sqljsAdapter.ts no mobile)
```

## Tarefas

- [ ] Transformar a raiz em workspace Yarn (v1) e criar `packages/core` (ESM + `.d.ts`).
- [ ] Configurar o Metro do mobile para monorepo e o Vite/Electron do desktop para resolver
  `@myfinances/core`.
- [ ] Mover `DbAdapter`, `sqljsAdapter` e `expoAdapter` para o core; criar `SqlJsFileAdapter`
  para o desktop (sql.js + persistência atômica em arquivo).
- [ ] Novo schema local espelhando o Postgres (Etapa 1): `uuid` em `TEXT`, `family_id`,
  `member_id`, `to_member_id`, `created_by`, `updated_at`, `deleted_at`, `change_xid`, mais as
  tabelas `_outbox`, `_sync_state`, `_sync_conflicts`, `families`, `members`.
- [ ] Portar os repositórios do mobile para o novo schema, cobrindo **todas** as operações que
  hoje existem nos IPCs do desktop (`IPC_CHANNELS` em `desktop/src/interfaces/IElectronBridge.ts`):
  categorias, cartões, lançamentos (listagem paginada com `summary`, CRUD, importação, prévia e
  execução da exclusão em lote), despesas fixas (CRUD, baixa do mês) e dashboard.
- [ ] Toda escrita de repositório: filtra por `family_id`, carimba `updated_at`, grava no
  `_outbox` na mesma transação, e "excluir" vira `deleted_at = now`.
- [ ] Unificar o `importParser` (hoje em `desktop/electron/services/importParser.service.ts` e
  `mobile/src/services/importParser.ts`) no core, com `import_hash` para dedupe.
- [ ] Use cases recebem `familyId` e usuário por um `SessionContext` injetado.
- [ ] Testes unitários dos repositórios e use cases com sql.js em memória.

## Mudanças de tipo que afetam a UI

| Campo | Hoje | Depois |
|---|---|---|
| `id` (todas as entidades) | `number` | `string` (uuid) |
| `active` | `0 \| 1` | `boolean` (no SQLite continua 0/1; o repositório converte) |
| `amount` | `number` (REAL) | Continua `REAL` no SQLite, arredondado a 2 casas na escrita; `numeric(14,2)` no Postgres |
| `Movement` | — | + `member_id`, `member_name`, `to_member_id`, `created_by`; `type` aceita `TRANSFER` |

## Pronto quando

- O core compila isolado e os testes passam com sql.js.
- Desktop e mobile importam `@myfinances/core` sem erro de bundler.

---

[[etapa-01-fundacao-supabase|← Etapa 1]] · [[README|Plano v2.0.0]] · [[etapa-03-sincronizacao|Etapa 3 →]]
