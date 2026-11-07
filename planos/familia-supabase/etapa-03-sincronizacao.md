# Etapa 3 — Sincronização offline-first

**Objetivo:** o app funciona 100% sem internet usando um SQLite local, e sincroniza sozinho
com o Supabase quando a conexão volta. O usuário não escolhe pasta: o arquivo fica na área
interna do app.

## Arquitetura

```
UI ──► use cases (core) ──► repositórios SQL ──► SQLite local   ◄── sempre lê/grava aqui
                                   │
                                   └─ mesma transação: INSERT em _outbox
                                                │
                     SyncEngine (core) ─────────┤ quando online
                       ├─ PUSH: _outbox → rpc('sync_push')   (lotes de 200)
                       └─ PULL: rpc('sync_pull', cursor) → upsert local
                            disparado por: abrir app · voltar online · Realtime · a cada 60 s
```

### Arquivo local
| Plataforma | Caminho | Engine |
|---|---|---|
| Desktop | `app.getPath('userData')/data/<projectRef>-<userId>.sqlite` | sql.js (sem módulo nativo, mantém o build Windows a partir do Mac) |
| Mobile | diretório padrão do `expo-sqlite`, mesmo nome | expo-sqlite |

Um arquivo por **projeto Supabase + usuário**: trocar de conexão ou de conta não mistura
dados. Logout pergunta se apaga a cópia local (se houver itens pendentes no outbox, avisa).

### Tabelas locais extras
- `_outbox (id, table_name, row_id, op, payload json, base_xid, created_at, attempts, last_error)`
- `_sync_state (family_id, cursor, last_pull_at, last_push_at)`
- `_sync_conflicts (...)`: espelho local para mostrar "o que foi sobrescrito"
- Todas as tabelas de domínio ganham `updated_at`, `deleted_at`, `change_xid` (texto) e
  `family_id`, espelhando o Postgres.

## Regras de sincronização

1. **IDs `uuid` gerados no cliente** (`crypto.randomUUID()` / `expo-crypto`): criar offline
   sem colisão.
2. **Escrita local + outbox na mesma transação.** Nunca existe alteração local sem pendência
   de envio.
3. **Outbox compactado:** várias edições da mesma linha antes do push viram uma só (guarda o
   payload mais recente e o `base_xid` mais antigo).
4. **Exclusão lógica** (`deleted_at`). Repositórios filtram `deleted_at IS NULL` em toda
   leitura. Excluir uma categoria mantém o `category_id` nos lançamentos, e a UI exibe "Sem
   categoria" quando a categoria está apagada (substitui o `ON DELETE SET NULL`).
5. **Ordem do push:** respeita dependências (categories → credit_cards → fixed_expenses →
   fixed_expense_payments → movements) para não violar FK no servidor.
6. **Conflito = último push vence**, por linha. O servidor grava a versão sobrescrita em
   `sync_conflicts` e devolve a lista. O app mostra um aviso discreto ("2 lançamentos foram
   alterados por outra pessoa") com acesso ao histórico.
7. **Cursor de pull = `xid8`**, não timestamp nem sequence. Explicação no cabeçalho de
   [`sql/004_sync.sql`](sql/004_sync.sql). O upsert local é idempotente porque o pull pode
   repetir linhas.
8. **Pull não sobrescreve pendência local:** se a linha recebida tem item no outbox, o local
   prevalece até o push (senão a edição offline "voltaria" antes de subir).
9. **Erros de push:** rede = tenta de novo com backoff exponencial. Erro de validação/RLS =
   marca o item com `last_error` e segue com os demais. A tela "Pendências de sincronização"
   permite reenviar ou descartar.
10. **Carga inicial** (primeiro login em um dispositivo): pull completo paginado, com barra de
    progresso; o cursor só é salvo no fim.

## Tarefas

- [ ] Aplicar `sql/004_sync.sql`: colunas de sync, trigger `sync_stamp`, `sync_push`,
  `sync_pull` e `sync_conflicts`. Revogar `DELETE` físico do `authenticated`.
- [ ] Paginação do `sync_pull` (`limit` por tabela + `has_more`).
- [ ] `SyncEngine` no core, independente de plataforma: recebe `DbAdapter`, client Supabase e
  um `NetworkMonitor` (desktop: `navigator.onLine` + ping; mobile: `@react-native-community/netinfo`).
- [ ] Migrações do schema **local** versionadas no core (`PRAGMA user_version`), aplicadas ao
  abrir o banco. Hoje há o `ensureColumn` ad hoc, que esta etapa substitui.
- [ ] Status de sync exposto à UI: `online | offline | sincronizando | X pendentes | erro`.
  Reaproveita a ideia do `SyncBanner` do mobile e do `DbSyncContext` do desktop.
- [ ] Desktop/sql.js: gravação em disco **atômica** (escreve num arquivo temporário e
  renomeia) com debounce de ~500 ms após cada transação, e flush no `before-quit`.
- [ ] **Testes** (com dois `SyncEngine` contra o Supabase local):
  - criar/editar/excluir offline nos dois e sincronizar: convergem para o mesmo estado;
  - mesma linha editada nos dois offline: o último push vence e o conflito é registrado;
  - exclusão em A e edição em B: com "último push vence", se B sobe depois, a linha é
    **ressuscitada** (`deleted_at` volta a null). Documentar como comportamento esperado;
  - transação aberta no servidor durante o pull não faz o cliente perder a linha (teste do
    cursor xid8);
  - app fechado no meio do push: nada duplica nem se perde;
  - pull repetido é idempotente.

## Fora do escopo

- Merge por campo (CRDT). A regra por linha basta para o uso familiar.
- Sincronização de anexos/arquivos.

## Pronto quando

- Dá para usar o app em modo avião por dias, voltar a internet e ver os dados aparecerem no
  outro dispositivo sem ação manual.
- Todos os testes de convergência acima passam.
