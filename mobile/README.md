# MyFinances Mobile

App Android (React Native + Expo) do MyFinances. Usa **o mesmo arquivo de banco** do
desktop (`db_myfinances.sqlite`), guardado no **OneDrive**: o que você lança no celular
aparece no computador e vice-versa.

Projeto independente do desktop: tem seu próprio `package.json`, dependências e build.

> Use **somente o Yarn** (v1, igual ao desktop) para instalar e rodar este projeto.
> Para adicionar pacotes nativos do Expo use `yarn expo install <pacote>`, que escolhe
> a versão compatível com o SDK.

## Como funciona a sincronização

1. Você entra com a conta Microsoft e escolhe o arquivo do banco no OneDrive.
2. O app baixa uma cópia para o celular e trabalha nela (funciona sem internet).
3. Cada alteração é enviada ao OneDrive (com ~1,5 s de espera para agrupar edições).
   O envio só é aceito se o arquivo no OneDrive ainda for a versão que o app baixou
   (`If-Match` com o eTag).
4. Se o arquivo foi alterado no computador antes do envio, **nada é sobrescrito**: a
   versão do celular é salva na mesma pasta como
   `db_myfinances.conflito-celular-<data>.sqlite`, o app baixa a versão do OneDrive e
   avisa para você conferir.
5. Com o app aberto, ele confere o OneDrive a cada 30 s, ao voltar para o app e ao
   puxar a tela para baixo.
6. O arquivo `db_myfinances.sqlite.lock` (mesmo formato do desktop) avisa quando o banco
   está aberto em outro dispositivo.

O login de usuário é o mesmo do desktop (mesmo usuário e senha, verificados com scrypt).

## Funcionalidades

- Dashboard: saldo, receitas, despesas, fixos, gráfico de 5 meses, despesas por
  categoria e por cartão, baixa das despesas fixas do mês
- Movimentações: navegação por mês, busca, filtro por cartão/tipo, faturas agrupadas por
  cartão + mês (expansíveis), criar/editar/excluir, **excluir todos os lançamentos de um
  cartão no mês**
- Despesas e receitas fixas com recorrência (mensal a anual), geração dos movimentos do
  período e baixa por mês
- Categorias (com limite mensal) e cartões de crédito
- Importação de fatura CSV do Nubank e do Banco Inter (mesmo parser do desktop)

## 1. Registrar o app no Microsoft Entra (uma vez)

O login no OneDrive precisa de um "Client ID" gratuito:

1. Acesse <https://portal.azure.com> → **Microsoft Entra ID** → **Registros de aplicativo**
   → **Novo registro**.
2. Nome: `MyFinances Mobile`.
   Tipos de conta: **Contas em qualquer diretório organizacional e contas pessoais da
   Microsoft**.
3. Em **URI de redirecionamento**, escolha **Cliente público/nativo (móvel e área de
   trabalho)** e informe:
   `https://login.microsoftonline.com/common/oauth2/nativeclient` (aparece como sugestão)
4. Após criar, copie o **ID do aplicativo (cliente)**.
5. Em **Permissões de APIs**, confira que existem (delegadas, Microsoft Graph):
   `User.Read`, `Files.ReadWrite` e `offline_access`. Não é preciso segredo.
6. Cole o ID em `app.json`:

   ```json
   "extra": { "microsoftClientId": "SEU-CLIENT-ID-AQUI" }
   ```

## 2. Rodar no celular (desenvolvimento)

### Login Microsoft (Expo Go e builds)

O login abre numa WebView dentro do próprio app e intercepta o retorno para
`https://login.microsoftonline.com/common/oauth2/nativeclient`. Por isso funciona igual
no Expo Go e nos builds, sem depender de esquema próprio (`myfinances://`) nem do IP do
Metro — no Android o navegador externo não devolvia o retorno ao app após "Continuar".

Chave de acesso (passkey) não funciona dentro da WebView: escolha **Outras maneiras de
entrar** e use senha, código por e-mail ou o Microsoft Authenticator.

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
| `yarn test:data` | Testes da camada de dados (Node + sql.js) |

## Estrutura

```
src/
  app/            telas (Expo Router)
  data/           banco: schema, repositórios (mesmas regras do desktop)
  services/       parser de faturas CSV
  sync/           login Microsoft, Graph API, sincronização e presença
  components/     componentes de interface
  theme/          cores do Figma
tests/            testes da camada de dados
```

## Cuidados

- **Estrutura do banco:** `src/data/schema.ts` precisa ficar igual a
  `desktop/electron/database/schema.ts`. Ao criar uma coluna/tabela num app, replique no outro.
- **Edição simultânea:** a regra é "quem salva primeiro ganha"; a outra versão vira cópia de
  conflito. Evite editar no celular e no computador ao mesmo tempo (o aviso amarelo ajuda).
- **Login no celular:** a verificação da senha (scrypt) pode levar alguns segundos.
  Marque "Manter conectado" para não precisar digitar sempre.
