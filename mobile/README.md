# MyFinances Mobile

App Android (Expo / React Native) do MyFinances v2: os dados da **família** ficam num
**SQLite local** do celular (funciona sem internet) e sincronizam com o **seu próprio
projeto Supabase**, o mesmo usado pelo desktop.

> Use **somente o Yarn** (v1, igual ao desktop). Para pacotes nativos do Expo use
> `yarn expo install <pacote>`, que escolhe a versão compatível com o SDK.

## Como funciona

1. **Conectar:** no computador, abra Perfil → **Conectar celular** e toque em **Ler QR Code**
   no celular. "Sou eu" entra na sua conta sem senha (o computador pede "Permitir");
   "Sou outra pessoa" cria a conta da pessoa e já a coloca na família. Também dá para colar
   um código de convite ou informar a URL e a publishable key manualmente.
2. **Offline-first:** o app lê e grava sempre no SQLite local (`expo-sqlite`, um arquivo por
   projeto + usuário). Sem internet, tudo funciona e as alterações ficam na fila.
3. **Sincronização:** o `SyncEngine` do `packages/core` envia a fila e traz as alterações dos
   outros membros. O Realtime do Supabase avisa quando alguém lança algo; ao voltar para o
   app, ele renova a sessão e busca novidades; ao ir para segundo plano, envia o que falta.
4. **Sessão segura:** a conexão e a sessão do Supabase ficam no `expo-secure-store`
   (Keystore), divididas em pedaços quando passam do limite de ~2 KB.

## Funcionalidades

- Dashboard com visão **Família | Eu | membro**: saldo, receitas, despesas, card "Por
  membro", transferências, gráfico de 5 meses, despesas por categoria e cartão e fixos do mês
- Movimentações: mês, busca, filtros por cartão/tipo/membro, faturas agrupadas por cartão +
  mês, **"De quem"** e **transferência entre membros**, exclusão em lote por cartão
- Despesas e receitas fixas com responsável, recorrência e baixa por mês
- Categorias (limite mensal da família), cartões e importação de fatura CSV (Nubank e Inter)
- Seletor de família no topo, membros e convites, perfil, aparelhos conectados e tela de
  sincronização (pendências recusadas: reenviar ou descartar)

## Rodar no celular (desenvolvimento)

> Depois de mudar dependências nativas (ex.: `expo-camera`, `netinfo`), gere de novo a
> pasta `android/` com `npx expo prebuild --clean` antes do build local.

### Opção A — development build pelo EAS (sem Android Studio)

Compila na nuvem um app de desenvolvimento (`expo-dev-client`) que se conecta ao Metro
com hot reload, como o Expo Go, mas com o esquema `myfinances://` registrado.

```bash
cd mobile
yarn install
npx eas-cli@latest login   # uma vez, com sua conta Expo
yarn eas:dev               # gera o APK de desenvolvimento e devolve um link/QR para instalar
yarn dev:client            # depois de instalado: abra o MyFinances no celular e conecte ao Metro
```

Só é preciso gerar um novo build de desenvolvimento quando mudar dependência nativa ou o
`app.json`; mudanças de código JS/TS chegam pelo hot reload.

### Opção B — build local (Android Studio)

Requisitos: Android Studio (SDK e `adb`) e o celular com depuração USB.

```bash
cd mobile
yarn install
yarn android   # compila e instala o app no celular conectado (expo run:android)
```

## 3. Gerar o APK para instalar (sem cabo)

```bash
npx eas-cli@latest login   # uma vez, com sua conta Expo
yarn eas:apk
```

O EAS compila na nuvem e devolve um link para baixar o `.apk` no celular.

## Scripts

| Comando | O que faz |
|---|---|
| `yarn android` | Build de desenvolvimento no celular/emulador |
| `yarn eas:dev` | Gera o build de desenvolvimento (dev client) na nuvem (EAS) |
| `yarn dev` | Metro para o Expo Go |
| `yarn dev:client` | Metro para o build de desenvolvimento (dev client) |
| `yarn eas:apk` | Gera o APK de instalação na nuvem (EAS) |
| `yarn typecheck` | Checagem de tipos |

As regras de negócio, a sincronização e os testes ficam no `packages/core`
(`yarn core:test` na raiz).

## Estrutura

```
src/
  app/            telas (Expo Router): connect/ (QR, código, manual), login, family, (tabs)...
  engine/         AppSession do core com expo-sqlite, NetInfo e supabase-js
  contexts/       AppStateContext (fase, usuário, família, sync, visão)
  connection/     store seguro (expo-secure-store)
  components/     componentes de interface
  theme/          cores do Figma
```
