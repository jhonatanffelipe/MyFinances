# MyFinances v2.0.0

Controle financeiro da **família**: funciona offline e sincroniza com o **seu próprio
projeto Supabase**. Primeira instalação? Siga o [guia de instalação](guia-instalacao.md).

> **Banco de dados:** instalação nova, schema versão **1**. Rode o `setup.sql` completo no
> SQL Editor do seu projeto Supabase. Quem usava a v1 importa o `db_myfinances.sqlite` pelo
> app ("Importar meu banco da v1"). Detalhes no [CHANGELOG](CHANGELOG.md).

## Downloads

Os instaladores ficam anexados ao
[GitHub Release v2.0.0](https://github.com/jhonatanffelipe/MyFinances/releases/tag/v2.0.0),
porque passam do limite de 100 MB por arquivo do repositório.

| Plataforma | Arquivo | Tamanho |
|---|---|---|
| Windows 10/11 (64 bits) | [MyFinances-Setup-2.0.0.exe](https://github.com/jhonatanffelipe/MyFinances/releases/download/v2.0.0/MyFinances-Setup-2.0.0.exe) | 98 MB |
| macOS (Apple Silicon) | [MyFinances-2.0.0-arm64.dmg](https://github.com/jhonatanffelipe/MyFinances/releases/download/v2.0.0/MyFinances-2.0.0-arm64.dmg) | 123 MB |
| Android | [MyFinances-2.0.0.apk](https://github.com/jhonatanffelipe/MyFinances/releases/download/v2.0.0/MyFinances-2.0.0.apk) | 118 MB |

Os apps não são assinados (Windows SmartScreen, Gatekeeper do macOS e "fontes
desconhecidas" do Android vão pedir confirmação). O passo a passo está no guia.

### SHA-256

```
bbc1dc876853871ea1dda647cdb32386f61156b470c565d1d665fa0da874822a  MyFinances-Setup-2.0.0.exe
66d5b0d08538a5b43193f0cea7f6c5b68aee60e50f5446ffc623613efbdc294c  MyFinances-2.0.0-arm64.dmg
c562faf5731863ea3a9d4429d3beffa61b86afe762c6e57243ef1d4590e2de36  MyFinances-2.0.0.apk
```

Conferir: `shasum -a 256 <arquivo>` (macOS/Linux) ou `certutil -hashfile <arquivo> SHA256`
(Windows).

## Arquivos do banco (nesta pasta)

| Arquivo | Para quê |
|---|---|
| [`setup.sql`](setup.sql) | Cria tudo no Supabase (idempotente: pode rodar de novo) |
| [`migrations/`](migrations) | As mesmas migrações separadas, para atualizações futuras |
| [`pair-device/index.ts`](pair-device/index.ts) | Edge Function opcional: conectar o celular pelo QR sem senha |
| [`guia-instalacao.md`](guia-instalacao.md) | Passo a passo para instalar com a sua família |
| [`CHANGELOG.md`](CHANGELOG.md) | O que mudou |

## Novidades

- **Família:** vários membros na mesma família, convites por código/QR e várias famílias por usuário.
- **Offline-first:** SQLite local nos dois apps, com sincronização automática e em tempo real.
- **Seu próprio Supabase:** sem servidor central; os dados ficam no seu projeto, protegidos por RLS.
- **Celular por QR:** "Sou eu" (sem senha) ou "Sou outra pessoa da família".
- **Dashboard da família** com visão por membro e transferências entre membros.
- **Importação do banco da v1**, no computador e no celular.
- Saiu o OneDrive: sem escolha de pasta, `.lock` ou arquivos de conflito.
