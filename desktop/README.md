# 💰 MyFinances

<div align="center">

![MyFinances Logo](public/icons/icon.png)

### **Controle Financeiro da Família: funciona offline e sincroniza com o seu próprio Supabase**

*Construído com Electron, React, TypeScript, Material-UI, Tailwind CSS, SQLite (WASM) e Supabase.*

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Electron](https://img.shields.io/badge/Electron-2B2E3A?style=for-the-badge&logo=electron&logoColor=9FEAF9)](https://www.electronjs.org/)
[![Material--UI](https://img.shields.io/badge/Material--UI-0081CB?style=for-the-badge&logo=material-ui&logoColor=white)](https://mui.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)

</div>

---

## 📌 Sobre o Projeto

O **MyFinances** é um aplicativo desktop para as finanças da **família**, com foco em **privacidade, uso offline e desempenho**.

- **Família como unidade de dados:** vários membros lançam na mesma família e o dashboard soma todos. Cada lançamento tem "de quem" é, e transferências entre membros (mesada, repasse) não inflam receita nem despesa da família.
- **Offline-first:** o app lê e grava sempre num **SQLite local** (pasta interna do app, uma por conta). Sem internet, tudo continua funcionando; as alterações ficam na fila e sobem quando a rede volta.
- **Seu próprio Supabase (BYO):** o app não traz URL nem chave embutidas. Na primeira execução você informa a *Project URL* e a *Publishable key* do **seu** projeto Supabase. Os dados ficam no seu projeto; o RLS do Postgres isola as famílias.
- **Celular por QR:** conecte o app Android lendo um QR no computador, sem digitar senha.

---

## ✨ Principais Funcionalidades

### 1. 📊 Dashboard Financeiro Completo
- **Cards de Indicadores (KPIs):** Saldo total acumulado, receitas do mês e despesas do mês com comparativos percentuais automáticos em relação ao mês anterior.
- **Gráfico Comparativo Mensal:** Barras interativas contrastando Receitas vs. Despesas ao longo dos últimos meses.
- **Gastos por Categoria:** Gráfico Donut com percentual e valores por grupo de gastos.
- **Distribuição por Cartão de Crédito:** Gráficos de barras e pizza demonstrando o consumo e a participação de cada cartão.
- **Filtro de Mês Rápido:** Navegação simples mês a mês em formato extenso (`Janeiro de 2026`).

### 2. 💸 Movimentações & Extrato Inteligente
- Lançamento ágil de **Receitas** e **Despesas**.
- Suporte a vinculação direta a Cartões de Crédito ou saídas em dinheiro/débito.
- **Filtros completos:** busca por texto, período com calendário MUI DatePicker pt-BR, categoria, tipo e cartão.
- **Paginação Server-Side:** navegação fluida com controle de linhas por página e ordenação no padrão Atlas.
- Resumo visual de totais (Entradas, Saídas e Saldo do filtro atual) no cabeçalho da listagem.

### 3. 📅 Despesas Fixas & Recorrentes
- Cadastro de contas mensais e recorrentes (Aluguel, Internet, Assinaturas, Mensalidades).
- Configuração de data de início, data de fim e dia de vencimento programado.
- Opção de pagamento recorrente via Cartão de Crédito ou Débito direto.

### 4. 🏷️ Categorias & Gestão de Orçamento
- Criação e personalização de categorias para Receitas e Despesas.
- Identificação por paleta de cores para gráficos do Dashboard.
- **Teto Orçamentário (Limite Mensal):** Defina um valor máximo mensal por categoria com indicadores visuais de consumo:
  - 🟢 *Dentro do limite* (< 80%)
  - 🟠 *Próximo do limite* (80% a 99%)
  - 🔴 *Atingido / Estourado* (>= 100%)

### 5. 💳 Cartões de Crédito
- Cadastro dos seus cartões de crédito com cores temáticas oficiais (Nubank, Inter, Itaú, XP, Bradesco, etc.).
- Configuração do dia de vencimento da fatura.
- Acompanhamento automático de faturas e histórico de despesas por cartão.

### 6. 👨‍👩‍👧 Família, membros e aparelhos
- Conta no Supabase Auth (e-mail e senha, "esqueci a senha").
- Criar família, convidar por código/QR, desativar e reativar membros, participar de várias famílias (seletor na barra lateral).
- **Conectar celular** por QR ("Sou eu" ou "Sou outra pessoa") e lista de **aparelhos conectados**, com "Desconectar".
- Indicador de sincronização (online/offline, pendentes, recusadas) com "Sincronizar agora".

### 7. 🛡️ Segurança
- A *publishable key* é pública por design; quem protege os dados é o login e o **RLS** do Postgres. A chave secreta (*service_role*) nunca entra no app.
- Conexão e sessão (refresh token) cifradas com o `safeStorage` do Electron (Keychain no macOS, DPAPI no Windows).
- Rede, banco local e credenciais ficam só no **processo main**; o renderer fala apenas por IPC.

### 8. ⌨️ Inputs Mascarados e DatePickers Avançados
- **MUI DatePicker** em português do Brasil (`dayjs` / `pt-br`) integrado em todos os seletores de data.
- **MaskedNumberField** baseado em `react-imask`:
  - Moeda no padrão brasileiro (`R$ 1.250,50`).
  - Dias do mês válidos (1 a 31).

---

## 🛠️ Tecnologias Utilizadas

- **Desktop Framework:** [Electron](https://www.electronjs.org/) (com processo principal modular e IPC handlers seguros)
- **Frontend:** [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **UI & Componentes:** [Material-UI (MUI v6)](https://mui.com/), [Tailwind CSS](https://tailwindcss.com/)
- **Gráficos:** [@mui/x-charts](https://mui.com/x/react-charts/)
- **Date Pickers:** [@mui/x-date-pickers](https://mui.com/x/react-date-pickers/) com [Dayjs](https://day.js.org/)
- **Formulários & Validação:** [React Hook Form](https://react-hook-form.com/), [Yup](https://github.com/jquense/yup), [react-imask](https://imask.js.org/)
- **Banco local:** [sql.js (SQLite WASM)](https://sql.js.org/) com persistência atômica em disco
- **Servidor:** [Supabase](https://supabase.com/) (Postgres + RLS, Auth, Realtime) via `@supabase/supabase-js`
- **Regras de negócio e sincronização:** pacote compartilhado `packages/core` (use cases, repositórios SQL, `SyncEngine`)
- **Ícones:** [Lucide React](https://lucide.dev/), [MUI Icons](https://mui.com/material-ui/material-icons/)
- **Empacotador:** [electron-builder](https://www.electron.build/)

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão LTS recomendada)
- [Yarn](https://yarnpkg.com/)

### 1. Clonar o Repositório
```bash
git clone https://github.com/jhonatanffelipe/MyFinances.git
cd MyFinances/desktop
```

### 2. Instalar as Dependências
> ⚠️ **Atenção:** utilize estritamente o `yarn` para gerenciamento dos pacotes deste projeto.
```bash
yarn install
```

### 3. Subir um Supabase local (opcional, para desenvolvimento)
Na raiz do repositório (precisa de Docker):
```bash
yarn db:start          # Supabase local: API em http://127.0.0.1:54321
yarn functions:serve   # Edge Function pair-device ("Sou eu" no QR do celular)
```
Na tela **Conectar** do app, use a URL `http://127.0.0.1:54321` e a *Publishable key* mostrada por `supabase status`.
Para um projeto real, o botão **Copiar script** da mesma tela copia o `supabase/setup.sql` para colar no SQL Editor.

### 4. Executar em Modo de Desenvolvimento
Inicia o Vite e abre a janela do aplicativo Electron com Hot Reload ativo:
```bash
yarn dev
```

### 5. Compilar para Produção (Gerar Instalador .exe)
Cria o executável de distribuição e o instalador NSIS para Windows dentro de `dist-electron/`:
```bash
yarn build
```

---

## 📂 Estrutura de Diretórios

```
desktop/
├── electron/                  # Processo main do Electron
│   ├── main.ts                # Janela, menu e registro dos handlers IPC
│   ├── preload.ts             # Ponte IPC (contextBridge) com erros tipados (code do AppError)
│   ├── app/
│   │   ├── appController.ts   # Conexão, sessão, banco local por usuário, sync e Realtime
│   │   ├── localDatabase.ts   # SQLite (sql.js) em userData/data/<projeto>-<usuário>.sqlite
│   │   └── networkMonitor.ts  # Online/offline para o SyncEngine
│   ├── connection/            # SafeStorageKeyValueStore (conexão + sessão cifradas)
│   └── ipc/                   # app.ipc.ts (conta, família, aparelhos, sync) e data.ipc.ts (cadastros)
├── public/                    # Ícones (.ico, .png) e assets estáticos
├── src/
│   ├── bridge.ts              # Monta window.electronAPI / window.appAPI a partir do preload
│   ├── components/            # Layout (seletor de família, sync), Devices (QR), Members, Sync...
│   ├── contexts/              # AppStateContext (fase, usuário, família, sync)
│   ├── interfaces/            # Contratos IPC (IElectronBridge, AppBridge)
│   ├── pages/
│   │   ├── onboarding/        # Conectar ao Supabase, login/cadastro e criar/entrar na família
│   │   ├── dashboard/         # KPIs e gráficos
│   │   ├── movements/         # Extrato, filtros (membro), transferências e importação
│   │   ├── fixed-entries/     # Despesas e receitas fixas
│   │   ├── categories/        # Categorias e limites mensais
│   │   ├── credit-cards/      # Cartões de crédito
│   │   ├── members/           # Membros, convites e conectar celular
│   │   └── profile/           # Perfil, senha, aparelhos e banco conectado
│   ├── routes/                # Onboarding até "ready"; depois as rotas do app
│   └── types/                 # Tipos do renderer (ids uuid)
├── package.json
└── vite.config.ts
```

---

## 📄 Licença

Este projeto está sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE) para obter mais informações.

<div align="center">
  Desenvolvido com carinho para proporcionar autonomia e tranquilidade financeira.
</div>
