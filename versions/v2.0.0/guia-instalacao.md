# Guia de instalação do MyFinances v2

Este guia é para quem vai usar o MyFinances com a própria família. Você cria um banco grátis
no Supabase (os dados ficam só com você), instala o app no computador e conecta os celulares.

Tempo estimado: 15 minutos. Baixe os arquivos na página da versão em
[Releases](https://github.com/jhonatanffelipe/MyFinances/releases):

| Arquivo | Para quê |
|---|---|
| `MyFinances-Setup-2.0.0.exe` | Instalador do Windows (64 bits) |
| `MyFinances-2.0.0-arm64.dmg` | Instalador do macOS (Apple Silicon: M1 ou mais novo) |
| `MyFinances-2.0.0.apk` | App Android |
| `setup.sql` | Script que cria o banco no Supabase |
| `pair-device/index.ts` | (Opcional) Conectar o celular pelo QR sem digitar senha |

> **Sobre as chaves do Supabase:** o app só usa a **Publishable key** (`sb_publishable_...`),
> que é pública por design: quem protege os dados é o login e as regras do banco (RLS).
> **Nunca** cole a *secret key* nem a *service_role* no app ou em qualquer mensagem.

---

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta grátis.
2. Clique em **New project**.
   - **Name:** por exemplo `myfinances-familia`.
   - **Database password:** gere uma senha forte e **guarde-a** (é usada só no backup, passo 9).
   - **Region:** **South America (São Paulo)**.
3. Aguarde o projeto ficar pronto (1 a 2 minutos).

## 2. Criar as tabelas

1. No menu lateral do projeto, abra **SQL Editor**.
2. Abra o `setup.sql` num editor de texto, copie **tudo** e cole no SQL Editor.
   (No app do computador também tem o botão **Copiar script**, que copia o mesmo conteúdo.)
3. Clique em **Run**. Deve aparecer *Success. No rows returned*.

O script pode ser rodado de novo sem problema.

## 3. Configurar o login e o QR do celular

**Login por e-mail (obrigatório):**

1. Abra **Authentication → Sign In / Providers → Email**.
2. Desligue **Confirm email** e salve.

   O envio de e-mails do plano grátis tem limite baixo. Se preferir manter a confirmação,
   configure um SMTP próprio em **Authentication → Emails → SMTP Settings**.

**Conectar o celular sem senha (opcional, recomendado):**

1. Abra **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nome da função: `pair-device` (exatamente assim).
3. Apague o código de exemplo, cole todo o conteúdo de `pair-device/index.ts` e clique em
   **Deploy function**.
4. Na página da função, aba **Details**, **desligue** a verificação de JWT
   (*Verify JWT* / *Enforce JWT verification*) e salve.

Quem usa a CLI pode fazer o mesmo com:

```bash
npx supabase functions deploy pair-device --no-verify-jwt --project-ref <id-do-projeto>
```

Sem essa função tudo funciona; a diferença é que, ao conectar o seu celular pelo QR, o app
pede a sua senha uma vez.

## 4. Copiar o endereço e a chave

1. Abra **Project Settings → API Keys** e copie a **Publishable key** (`sb_publishable_...`).
2. Copie a **Project URL** (`https://xxxx.supabase.co`). Ela aparece no botão **Connect** no
   topo do painel e em **Project Settings → Data API**.

## 5. Instalar no computador

1. Instale o app:
   - **Windows:** rode o `MyFinances-Setup-2.0.0.exe`. O Windows pode mostrar "O Windows
     protegeu o computador", porque o instalador não é assinado. Clique em
     **Mais informações → Executar assim mesmo**.
   - **macOS:** abra o `MyFinances-2.0.0-arm64.dmg` e arraste o MyFinances para
     **Aplicativos**. Como o app não é assinado pela Apple, na primeira vez o macOS bloqueia a
     abertura: vá em **Ajustes do Sistema → Privacidade e Segurança**, role até o aviso do
     MyFinances e clique em **Abrir Mesmo Assim**. Se aparecer "está danificado", rode no
     Terminal `xattr -cr /Applications/MyFinances.app` e abra de novo.
2. Na tela **Conectar ao seu banco**, aba **Criar meu banco**, cole a **Project URL** e a
   **Publishable key**.
3. Clique em **Testar conexão** e depois em **Conectar**.

Se aparecer uma mensagem de erro, ela diz o que falta (por exemplo: chave errada, projeto
pausado ou "rode o setup.sql").

## 6. Criar a conta e a família

1. Crie a sua conta (nome, e-mail e senha).
2. Na aba **Criar família**, dê um nome (por exemplo "Casa") e clique em **Criar família**.
   Ela já vem com as categorias padrão.
3. Na tela **Você já usa o MyFinances v1?**:
   - Quem usava a v1: **Importar meu banco da v1** e selecione o `db_myfinances.sqlite`
     (na pasta do OneDrive que você usava). Lançamentos, fixos, categorias e cartões vêm
     para a família.
   - Quem está começando: **Começar do zero**.

   Dá para importar depois em **Perfil**.

## 7. Conectar celulares e convidar a família

**Instalar o app no celular:** abra o `MyFinances-2.0.0.apk` no Android e permita instalar
apps desta fonte quando o celular pedir.

**Pessoa que está perto do computador (você ou alguém da família):**

1. No computador, abra **Membros → Conectar celular** (ou **Perfil → Conectar celular**).
   Aparece um QR Code.
2. No celular, toque em **Ler QR Code** e aponte para a tela.
3. Escolha:
   - **Sou eu**: o celular entra na sua conta. No computador, clique em **Permitir**.
   - **Sou outra pessoa da família**: a pessoa cria a conta dela e já entra na família.

**Pessoa que está longe:**

1. No computador, abra **Membros → Convidar** e copie o código (começa com `mf1.`).
2. Mande pelo WhatsApp ou e-mail.
3. A pessoa instala o app, escolhe **Tenho um código de convite**, cola o código e cria a
   conta dela.

Todos os membros veem e editam os lançamentos da família. Para tirar alguém, use
**Membros → Desativar**. Para desconectar um celular, **Perfil → Aparelhos conectados**.

## 8. Projeto pausado (plano grátis)

O Supabase grátis **pausa o projeto depois de ~7 dias sem uso**. O app continua funcionando
offline, mas avisa que o projeto está pausado e não sincroniza.

Para reativar: [supabase.com/dashboard](https://supabase.com/dashboard) → abra o projeto →
**Restore project**. Leva alguns minutos; depois disso o app sincroniza sozinho.

## 9. Backup

Cada aparelho guarda uma cópia local, mas o backup de verdade é o do Supabase.

**Plano pago:** **Database → Backups** tem backups diários automáticos.

**Plano grátis (manual, recomendado uma vez por mês):**

1. No painel, clique em **Connect** (topo) e copie a *connection string* do
   **Session pooler**. Ela tem o formato:

   ```
   postgresql://postgres.<id-do-projeto>:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
   ```

   Troque `[YOUR-PASSWORD]` pela senha do banco do passo 1.
2. Instale o cliente do PostgreSQL na mesma versão principal do projeto (veja em
   **Project Settings → Infrastructure**). No Windows: instalador do
   [postgresql.org](https://www.postgresql.org/download/windows/), só o item
   *Command Line Tools*.
3. Gere o backup (dados da família **e** as contas de login, que os lançamentos referenciam):

   ```bash
   pg_dump "postgresql://postgres.<id>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" \
     --schema=public --schema=auth --data-only --no-owner --no-privileges \
     --file=myfinances-AAAA-MM-DD.sql
   ```

4. Guarde o arquivo `.sql` fora do computador (pendrive, nuvem). Ele contém os dados de
   todos da família: trate como documento sigiloso.

**Restaurar** (raro: projeto apagado ou corrompido): crie um projeto novo, rode o `setup.sql`
(passo 2) e siga o procedimento oficial do Supabase,
[Backup and restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
Depois, conecte os aparelhos ao projeto novo (Perfil → Banco conectado → **Trocar de banco**).

## 10. Atualizar para uma versão nova

1. Leia o `CHANGELOG.md` da versão. Se ele disser **migração de banco obrigatória**, rode no
   **SQL Editor** os arquivos de `migrations/` indicados (ou o `setup.sql` completo).
2. Instale o `.exe` / `.dmg` e o `.apk` novos por cima dos antigos. Os dados locais são mantidos.

Se o banco estiver desatualizado, o app avisa qual script rodar antes de continuar.

---

## Problemas comuns

| Mensagem | O que fazer |
|---|---|
| "O projeto recusou a chave" | Copie de novo a **Publishable key** (passo 4). |
| "Não encontramos esse projeto" | Confira a **Project URL**: deve terminar em `.supabase.co`. |
| "Rode o setup.sql" / banco desatualizado | Refaça o passo 2. |
| "O projeto está pausado" | Passo 8. |
| Cadastro pede confirmação de e-mail e o e-mail não chega | Desligue **Confirm email** (passo 3). |
| QR do celular pede senha | A função `pair-device` não foi criada ou está com JWT ligado (passo 3). |
