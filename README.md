# 💰 MyFinances

Controle financeiro da **família**, com dois apps que funcionam **offline** e sincronizam
com o **seu próprio projeto Supabase**:

| Projeto | Pasta | Tecnologia |
|---|---|---|
| **Desktop (Windows)** | [`desktop/`](desktop/README.md) | Electron + React + MUI + sql.js |
| **Mobile (Android)** | [`mobile/`](mobile/README.md) | React Native (Expo) + expo-sqlite |
| **Core compartilhado** | `packages/core/` | TypeScript puro: schema local, repositórios, use cases e `SyncEngine` |
| **Banco** | `supabase/` | Migrações SQL (RLS), `setup.sql` e a Edge Function `pair-device` |

Todos os projetos usam **Yarn** (v1).

> **Vai instalar para a sua família?** Siga o [guia de instalação](docs/guia-instalacao.md).
> O que mudou em cada versão está no [CHANGELOG](CHANGELOG.md).

## Como funciona (v2)

- **Família como unidade de dados:** vários membros lançam na mesma família e o dashboard
  soma todos, com filtro por membro. Transferências entre membros não inflam os totais.
- **Offline-first:** cada aparelho lê e grava num **SQLite local**, numa pasta interna do
  app. Um sincronizador (outbox + `sync_push`/`sync_pull`) envia as alterações e traz as dos
  outros membros sempre que há internet. O Supabase Realtime avisa quando alguém lança algo.
- **Seu próprio Supabase (BYO):** o app não traz URL nem chave. Cada instalação informa a
  *Project URL* e a *Publishable key* do próprio projeto. O RLS do Postgres isola as
  famílias; a chave secreta (*service_role*) nunca entra no app.
- **Celular por QR:** no computador, *Conectar celular*; no celular, *Ler QR Code*.

A v1 (um arquivo SQLite compartilhado pelo OneDrive) continua disponível na tag `v1.0.0`.
O banco da v1 pode ser importado pela v2 (primeiro uso ou Perfil → Importar).

## Desenvolvimento

```bash
# Supabase local (Docker) + testes de RLS
yarn db:start
yarn db:test
yarn functions:serve        # Edge Function pair-device

# Core (regras de negócio e sincronização)
yarn core:install && yarn core:test

# Desktop
cd desktop && yarn install && yarn dev

# Mobile
cd mobile && yarn install && yarn android
```

Ao mudar qualquer arquivo em `supabase/migrations/`, rode `yarn db:bundle` para gerar de novo
o `supabase/setup.sql`.

## Release

```bash
cd desktop && yarn build:win     # release/MyFinances-Setup-x.y.z.exe
cd mobile && yarn eas:apk        # APK pelo EAS (baixe e coloque em release/vX.Y.Z/)
yarn release:assets              # junta setup.sql, migrations/, pair-device, guia e CHANGELOG
```

`yarn release:assets` monta `release/vX.Y.Z/` com tudo o que vai para o GitHub Release
(o `.exe` é copiado se já existir em `desktop/release/`).
