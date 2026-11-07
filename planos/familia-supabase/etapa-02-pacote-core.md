---
tags:
  - myfinances
  - plano/v2
  - etapa
aliases:
  - "Etapa 2"
  - "Pacote core compartilhado"
etapa: 2
status: concluída
plano: "[[README|Plano v2.0.0]]"
depende_de:
  - "[[etapa-01-fundacao-supabase]]"
---
# Etapa 2 — Pacote `core` compartilhado (local-first)

**Objetivo:** uma única implementação de regras de negócio e acesso a dados, usada pelo
desktop e pelo mobile, **sobre o SQLite local**. Isso acaba com a duplicação atual
(`desktop/electron/ipc/*.ipc.ts` com SQL inline × `mobile/src/data/repositories/*.ts`).

## Decisão: pacote por código-fonte, sem workspace hoisted

O plano previa Yarn workspaces. Na prática o desktop usa **React 18** e o mobile **React 19**,
e um `node_modules` hoisted misturaria as duas versões. Por isso:

- `packages/core` é TypeScript puro, **sem dependências de runtime** (só devDependencies para
  testes), com `node_modules` próprio.
- Os apps resolvem `@myfinances/core` pelo código-fonte: alias no `desktop/vite.config.ts`
  (renderer **e** processo main), `mobile/metro.config.js`
  (`watchFolders` + `extraNodeModules`), e `paths` nos dois `tsconfig.json`.
- Infraestrutura de cada plataforma fica no app (Clean Architecture): o adaptador do
  expo-sqlite continua no mobile, a gravação do arquivo do sql.js fica no desktop. O core
  define as portas (`DbAdapter`, `SessionProvider`, `Clock`, `IdGenerator`).

## Estrutura

```
packages/core/
  src/
    domain/          types, ports (sessão, relógio, uuid), interfaces dos repositórios,
                     date, money, recurrence
    db/              DbAdapter, sqljsAdapter, schema local (PRAGMA user_version), LocalStore + outbox
    repositories/    sqlite/: família, categorias, cartões, lançamentos, fixos, dashboard
    use-cases/       um use case por operação + validação
    services/        importParser (CSV Nubank/Inter) com import_hash
    connection/      código mf1 (QR), validação de URL/chave, MIN_SCHEMA_VERSION, base64url
    errors/          AppError com códigos estáveis
    createCore.ts    raiz de composição
  tests/             node:test + sql.js em memória (yarn core:test)
```

## Tarefas

- [x] Criar `packages/core` (ESM, `main` apontando para `src/index.ts`).
- [x] Configurar Vite/Electron (renderer e main) e Metro para resolver `@myfinances/core`.
  Verificado com um import temporário: `tsc` dos dois apps, `vite build` do desktop e
  `expo export --platform android` (bundle Hermes) incluem o core.
- [x] `DbAdapter` e `createSqlJsAdapter` no core (o adaptador do expo-sqlite fica no mobile).
- [x] Schema local espelhando o Postgres: uuid em `TEXT`, `family_id`, `member_id`,
  `to_member_id`, `created_by`, `updated_at`, `deleted_at`, `change_xid`, tabelas
  `families`, `members`, `_outbox`, `_sync_state`, `_sync_conflicts`. Sem FKs entre as
  tabelas da família: o pull pode trazer filhos antes dos pais; a integridade é garantida
  pelos use cases e pelo servidor.
- [x] Repositórios cobrindo todos os IPCs atuais: categorias, cartões, lançamentos
  (listagem paginada com `summary`, agrupamento de faturas, CRUD, importação, prévia e
  execução da exclusão em lote), despesas fixas (CRUD, baixa do mês) e dashboard.
- [x] Toda escrita filtra por `family_id`, carimba `updated_at` e grava no `_outbox` na
  mesma transação (`LocalStore.write` + `markDirty`). O outbox é compactado por linha e
  guarda o `base_xid` da primeira edição local. Excluir vira `deleted_at`.
- [x] `importParser` unificado no core, com `import_hash` estável (banco, cartão, data
  original, tipo, valor, descrição normalizada e ocorrência no arquivo).
- [x] Use cases recebem a família e o usuário pelo `SessionProvider` injetado.
- [x] Testes: 38 casos (`yarn core:test`).

## Ajustes feitos no servidor por causa do soft delete

- `categories`: o `unique (family_id, type, name)` virou índice único **parcial**
  (`where deleted_at is null`). Sem isso, uma categoria excluída bloquearia outra com o
  mesmo nome.
- `movements_import_hash_uq`: também parcial, para permitir reimportar algo que foi excluído.
- Projetos que já rodaram o `setup.sql` antigo só precisam rodar o novo (é idempotente).

## Pontos para a Etapa 3

- Baixa de fixo (`fixed_expense_payments`) é única por (fixo, mês). Se dois aparelhos
  derem baixa offline no mesmo mês, cada um cria uma linha com id diferente e o push do
  segundo bate na unicidade. O `SyncEngine` precisa tratar esse caso adotando a linha do
  servidor.
- Excluir categoria ou cartão marca no outbox todos os lançamentos que os usavam. Numa
  categoria muito usada, o push sai em vários lotes.

## Mudanças de tipo que afetam a UI

| Campo | Hoje | Depois |
|---|---|---|
| `id` (todas as entidades) | `number` | `string` (uuid); a fatura agrupada usa `invoice_<cartão>_<YYYY-MM>` |
| `active` | `0 \| 1` | `boolean` (no SQLite continua 0/1; o repositório converte) |
| `amount` | `number` (REAL) | Continua `REAL` no SQLite, arredondado a 2 casas na escrita; `numeric(14,2)` no Postgres |
| `Movement` | — | + `member_id`, `member_name`, `to_member_id`, `to_member_name`, `created_by`, `import_hash`; `type` aceita `TRANSFER` |
| Importação | `executeImport` devolve `number` | devolve `{ imported, skipped }`; a análise traz `alreadyImportedCount` |
| Erros | `Error` com texto | `AppError` com `code` (`VALIDATION`, `NOT_FOUND`, `NOT_MEMBER`, `CONFLICT`...) |

## Pronto quando

- O core compila isolado e os testes passam com sql.js.
- Desktop e mobile importam `@myfinances/core` sem erro de bundler.

---

[[etapa-01-fundacao-supabase|← Etapa 1]] · [[README|Plano v2.0.0]] · [[etapa-03-sincronizacao|Etapa 3 →]]
