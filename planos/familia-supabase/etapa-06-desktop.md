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

- [ ] `electron/data/bootstrap.ts`: abre `userData/data/<projectRef>-<userId>.sqlite`, aplica
  as migrações locais, cria o `SyncEngine` e o liga ao Realtime.
- [ ] Migrar os handlers um módulo por vez: categories → creditCards → fixedExpenses →
  movements (importação e exclusão em lote) → dashboard.
- [ ] Novo IPC `sync:status` (evento) + `sync:now` (forçar) + `sync:pending` (listar/reenviar/
  descartar). Isso substitui `DB_SYNC_EVENT`, `DB_GET_SYNC_STATUS` e `DB_CHECK_EXTERNAL`.
- [ ] Indicador no `AppLayout`: online/offline, "sincronizando", "N pendentes", erro.
- [ ] Tela **Conectar celular** (Perfil e menu do seletor de família): QR gerado por
  `create_device_link`, contagem regressiva e regeneração automática ao expirar. Detalhes em
  [fluxo-conectar-celular.md](fluxo-conectar-celular.md).
- [ ] **Diálogo de aprovação** global ("Moto G quer conectar. Permitir / Negar"), disparado
  pelo Realtime em `device_pairings`. Aparece em qualquer tela enquanto o QR estiver válido.
- [ ] **Perfil → Aparelhos conectados**: lista de `user_devices` com "Desconectar".
- [ ] Campo **"De quem"** (`member_id`) no `MovementModal` e no `FixedEntryModal`. Padrão = o
  usuário logado; qualquer membro pode escolher outro (todos editam tudo).
- [ ] Tipo **Transferência** no `MovementModal`: "De" → "Para", sem categoria.
- [ ] Coluna "Membro" na `MovementTable` e filtro "Membro" em `MovementFilters`.
- [ ] Exclusão (individual e em lote) com confirmação mostrando de quem é o lançamento.
- [ ] Remover: `electron/database/lock.ts`, `syncEvents.ts`, a detecção de mudança externa e
  de arquivos `*.conflito-*`, `db.ipc.ts` (escolha de pasta/arquivo), `pages/db-setup` e o
  `DbSyncContext` atual.
- [ ] Ajustar o `README` do desktop.

## Pronto quando

- Todas as telas atuais funcionam **com a rede desligada**, e as alterações sobem ao religar.
- Não sobra nenhuma referência a OneDrive, `.lock` ou escolha de pasta.
