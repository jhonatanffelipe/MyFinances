# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). A versão do
app (`x.y.z`) é independente da **versão do schema** do banco (`app_meta.schema_version`).

Cada versão diz se exige **migração de banco**. Quando exige, rode no **SQL Editor** do seu
projeto Supabase os arquivos de `migrations/` listados, na ordem (ou o `setup.sql` completo,
que é idempotente). O app bloqueia com uma mensagem clara enquanto o banco estiver atrás.

## [2.0.0] — 2026-11-07

> **Migração de banco obrigatória:** instalação nova. Rode o `setup.sql` completo
> (schema versão **1**). Quem vem da v1 não tem banco no Supabase ainda: crie o projeto,
> rode o `setup.sql` e use **"Importar meu banco da v1"** no app.

### Adicionado
- **Família como unidade de dados:** vários membros, convites por código/QR, várias famílias
  por usuário com seletor, membros desativáveis.
- **Supabase próprio (BYO):** cada instalação usa a Project URL e a Publishable key do
  próprio projeto. RLS isola as famílias; FKs compostas impedem misturar dados entre elas.
- **Offline-first:** SQLite local nos dois apps, outbox e sincronização (`sync_push` /
  `sync_pull`) com cursor por transação, exclusão lógica e log de conflitos.
- **Tempo real:** as telas atualizam quando outro membro lança (Supabase Realtime).
- **Dashboard da família:** visão Família / Eu / por membro e card "Por membro".
- **Transferências entre membros** (mesada, repasse), fora dos totais da família.
- **Conectar celular por QR:** "Sou eu" (sem senha, aprovado no computador; precisa da Edge
  Function `pair-device`) ou "Sou outra pessoa" (convite). Lista de aparelhos conectados.
- **Importar o banco da v1** (`db_myfinances.sqlite`) no primeiro uso ou pelo Perfil, no
  desktop e no celular.
- Conta no Supabase Auth (e-mail e senha, "esqueci a senha").

### Alterado
- Valores em `numeric(14,2)` no servidor e IDs `uuid`.
- Regras de negócio e sincronização num pacote compartilhado (`packages/core`).
- Instalador do Windows gerado em `desktop/release/` (`yarn build:win`).

### Removido
- Banco compartilhado pelo OneDrive: escolha de pasta, `.lock`, arquivos `*.conflito-*`
  e login Microsoft (Graph) no celular.
- Senha local (`users.password_hash`): o login agora é do Supabase Auth.

## [1.0.0]

Versão com um único arquivo SQLite compartilhado pelo OneDrive (desktop pela pasta
sincronizada, celular pela Microsoft Graph). Disponível na tag `v1.0.0`.
