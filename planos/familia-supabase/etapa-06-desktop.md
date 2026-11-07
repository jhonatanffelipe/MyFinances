---
tags:
  - myfinances
  - plano/v2
  - etapa
aliases:
  - "Etapa 6"
  - "Desktop local-first"
etapa: 6
status: concluída
plano: "[[README|Plano v2.0.0]]"
depende_de:
  - "[[etapa-05-auth-familias]]"
---
# Etapa 6 — Desktop local-first

**Objetivo:** o desktop usa o core (SQLite local + sincronização) no lugar do banco no
OneDrive, **sem reescrever a UI**.

## Estratégia

Manter o contrato `IElectronBridge` / `IPC_CHANNELS` e trocar só a implementação dos
handlers em `desktop/electron/ipc/*.ipc.ts`: cada handler vira uma chamada de use case do core.
Páginas e hooks (`useMovements`, `useDashboard`...) continuam iguais, exceto pela mudança de
tipos (`id: string` etc., ver Etapa 2).

Tudo roda no **processo main**: o SQLite local (sql.js), o `SyncEngine` e o client Supabase,
com a sessão cifrada via `safeStorage`. O renderer continua sem acesso a rede, arquivo ou
credenciais.

## Tarefas

- [x] `electron/data/bootstrap.ts`: abre `userData/data/<projectRef>-<userId>.sqlite`, aplica
  as migrações locais, cria o `SyncEngine` e o liga ao Realtime.
- [x] Migrar os handlers um módulo por vez: categories → creditCards → fixedExpenses →
  movements (importação e exclusão em lote) → dashboard.
- [x] Novo IPC `sync:status` (evento) + `sync:now` (forçar) + `sync:pending` (listar/reenviar/
  descartar). Isso substitui `DB_SYNC_EVENT`, `DB_GET_SYNC_STATUS` e `DB_CHECK_EXTERNAL`.
- [x] Indicador no `AppLayout`: online/offline, "sincronizando", "N pendentes", erro.
- [x] Tela **Conectar celular** (Perfil e menu do seletor de família): QR gerado por
  `create_device_link`, contagem regressiva e regeneração automática ao expirar. Detalhes em
  [[fluxo-conectar-celular|Conectar celular por QR]].
- [x] **Diálogo de aprovação** global ("Moto G quer conectar. Permitir / Negar"), disparado
  pelo Realtime em `device_pairings`. Aparece em qualquer tela enquanto o QR estiver válido.
- [x] **Perfil → Aparelhos conectados**: lista de `user_devices` com "Desconectar".
- [x] Campo **"De quem"** (`member_id`) no `MovementModal` e no `FixedEntryModal`. Padrão = o
  usuário logado; qualquer membro pode escolher outro (todos editam tudo).
- [x] Tipo **Transferência** no `MovementModal`: "De" → "Para", sem categoria.
- [x] Coluna "Membro" na `MovementTable` e filtro "Membro" em `MovementFilters`.
- [x] Exclusão (individual e em lote) com confirmação mostrando de quem é o lançamento.
- [x] Remover: `electron/database/lock.ts`, `syncEvents.ts`, a detecção de mudança externa e
  de arquivos `*.conflito-*`, `db.ipc.ts` (escolha de pasta/arquivo), `pages/db-setup` e o
  `DbSyncContext` atual.
- [x] Ajustar o `README` do desktop.

## Herdado da Etapa 4

- [x] Tela **Conectar** (substitui `db-setup`): Criar meu banco (URL + publishable key, link
  "onde acho isso?", botão "Copiar script de instalação") e Tenho um código de convite.
  Usa `checkConnection` e mostra a mensagem de cada `AppError`.
- [x] Perfil → **Conexão**: ver o projeto, testar, trocar (com logout) e esquecer.
- [x] supabase-js no processo main com `auth.storage = new SafeStorageKeyValueStore()`.

## Herdado da Etapa 5

- [x] Login, cadastro e "esqueci a senha" com `createAccount` (`signIn`, `signUp`,
  `requestPasswordReset`); ao abrir, `session.resume({ online })`.
- [x] Onboarding sem família: Criar família / Tenho convite.
- [ ] Depois de criar a família, "Importar meu banco da v1" ou "Começar do zero" → fica para a
  [[etapa-09-migracao-dados|Etapa 9]].
- [x] Seletor de família no `AppLayout` (criar outra, aceitar convite) e `FamilyContext`.
- [x] Tela Membros: lista, Convidar (código + QR), desativar e reativar.
- [x] Perfil: dados, senha, Conectar celular (QR com contagem regressiva, regenera ao
  expirar), diálogo "Permitir" via Realtime em `device_pairings`, Aparelhos conectados.
- [x] `RegisterDevice` após o login (plataforma `desktop`).
- [x] Remover `auth.service.ts`, `auth.ipc.ts` (SQL) e `scripts/reset-password.mjs`.

## Como ficou (2026-11-07)

- **Processo main:** `electron/app/appController.ts` orquestra conexão, sessão, banco local por
  usuário (`userData/data/<projectRef>-<userId>.sqlite`, sql.js com gravação atômica),
  `SyncEngine` e Realtime (`postgres_changes` da família → `requestSync`; `device_pairings` →
  diálogo de aprovação). Handlers em `ipc/app.ipc.ts` (conta, família, aparelhos, sync) e
  `ipc/data.ipc.ts` (mesmos canais da v1 sobre os use cases do core).
- **Abertura offline-first:** `resume({ online: false })` abre na hora com as famílias do cache
  local; `AccountSession.refreshFamilies()` (novo no core) atualiza a lista em segundo plano e
  de novo quando a rede volta. Criar/entrar em família e o primeiro acesso no computador
  aguardam o primeiro pull.
- **Erros tipados no renderer:** o `contextBridge` só preserva `message` de um `Error`; o preload
  devolve envelopes `{ ok, value | error }` e `src/bridge.ts` remonta o erro com `code` e
  `details` do `AppError`.
- **Exclusão em lote:** a prévia (`BulkDeletePreview.members`) mostra de quem são os lançamentos.
- **Verificado:** E2E dirigindo o Electron por CDP contra o Supabase local (conectar → cadastro
  → família → CRUD → sync → convite/QR → sair/entrar) e cenário offline com o servidor
  derrubado (lança offline, reabre sem servidor em ms, religa e as pendências sobem).

## Pronto quando

- Todas as telas atuais funcionam **com a rede desligada**, e as alterações sobem ao religar.
- Não sobra nenhuma referência a OneDrive, `.lock` ou escolha de pasta.

---

[[etapa-05-auth-familias|← Etapa 5]] · [[README|Plano v2.0.0]] · [[etapa-07-totalizacao-familia|Etapa 7 →]]
