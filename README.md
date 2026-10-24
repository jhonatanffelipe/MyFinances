# 💰 MyFinances

Controle financeiro pessoal com **dois apps independentes que usam o mesmo banco**:

| Projeto | Pasta | Tecnologia |
|---|---|---|
| **Desktop** | [`desktop/`](desktop/README.md) | Electron + React + MUI + sql.js |
| **Mobile (Android)** | [`mobile/`](mobile/README.md) | React Native (Expo) + expo-sqlite |

Cada pasta é um projeto separado, com seu próprio `package.json`, dependências e build.
Os dois usam **Yarn** (v1) como gerenciador de pacotes.

## Banco compartilhado pelo OneDrive

O banco é um único arquivo SQLite (`db_myfinances.sqlite`) numa pasta do OneDrive:

- **Desktop:** abre o arquivo pela pasta sincronizada pelo OneDrive no computador. Antes de
  gravar, confere se o arquivo mudou por fora. Se mudou, não sobrescreve: recarrega a
  versão nova e guarda a alteração local como cópia `*.conflito-*.sqlite`.
- **Mobile:** acessa o mesmo arquivo pela API do OneDrive (Microsoft Graph), trabalha numa
  cópia local e envia cada alteração com controle de versão (eTag), com a mesma regra de
  conflito.
- Os dois gravam `db_myfinances.sqlite.lock` para avisar quando o banco está aberto em
  outro dispositivo.

> A estrutura do banco (`desktop/electron/database/schema.ts` e `mobile/src/data/schema.ts`)
> precisa ser mantida igual nos dois projetos.

## Rodando

```bash
# Desktop
cd desktop && yarn install && yarn dev

# Mobile (veja mobile/README.md para configurar o login Microsoft)
cd mobile && yarn install && yarn android
```
