# 💰 MyFinances

<div align="center">

![MyFinances Logo](public/icons/icon.png)

### **Controle Financeiro Pessoal Inteligente, Seguro e 100% Offline**

*Construído com Electron, React, TypeScript, Material-UI, Tailwind CSS e SQLite (WASM).*

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Electron](https://img.shields.io/badge/Electron-2B2E3A?style=for-the-badge&logo=electron&logoColor=9FEAF9)](https://www.electronjs.org/)
[![Material--UI](https://img.shields.io/badge/Material--UI-0081CB?style=for-the-badge&logo=material-ui&logoColor=white)](https://mui.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)

</div>

---

## 📌 Sobre o Projeto

O **MyFinances** é um aplicativo desktop moderno para gestão de finanças pessoais desenvolvido com foco em **privacidade absoluta, usabilidade refinada e desempenho rápido**.

Diferente de serviços convencionais baseados em nuvem onde seus dados financeiros ficam expostos em servidores de terceiros, o **MyFinances opera de forma 100% local**:
- Você escolhe a pasta onde seu banco de dados (`db_myfinances.sqlite`) será armazenado (disco local, pen drive criptografado, OneDrive, Google Drive, etc.).
- Acesso protegido por senha local criptografada com algoritmo seguro (`scrypt`).
- Total fidelidade aos layouts e design system do Figma (tema elegante com Verde Esmeralda `#10b981` e Dark Blue/Slate).

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

### 6. 🛡️ Segurança e Autenticação Local
- Escolha da pasta do banco de dados na primeira execução.
- Cadastro e login protegidos com hash criptográfico `scrypt`.
- Banco de dados em arquivo local único (`db_myfinances.sqlite`) via **`sql.js` (WebAssembly)**, garantindo compatibilidade multiplataforma sem dependências de compilação C++ nativa (`node-gyp`).

### 7. ⌨️ Inputs Mascarados e DatePickers Avançados
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
- **Banco de Dados:** [sql.js (SQLite WASM)](https://sql.js.org/) com persistência atômica em disco
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
cd MyFinances
```

### 2. Instalar as Dependências
> ⚠️ **Atenção:** utilize estritamente o `yarn` para gerenciamento dos pacotes deste projeto.
```bash
yarn install
```

### 3. Executar em Modo de Desenvolvimento
Inicia o Vite e abre a janela do aplicativo Electron com Hot Reload ativo:
```bash
yarn dev
```

### 4. Compilar para Produção (Gerar Instalador .exe)
Cria o executável de distribuição e o instalador NSIS para Windows dentro de `dist-electron/`:
```bash
yarn build
```

---

## 📂 Estrutura de Diretórios

```
MyFinances/
├── electron/                  # Código do processo principal do Electron
│   ├── main.ts                # Inicialização da janela, menu e IPC handlers
│   └── preload.ts             # Ponte de comunicação IPC segura (contextBridge)
├── public/                    # Ícones (.ico, .png) e assets estáticos
├── src/
│   ├── components/            # Componentes reutilizáveis
│   │   ├── Layout/            # Sidebar, Topbar e estrutura de páginas
│   │   ├── MaskedField/       # Inputs com máscara monetária e numérica
│   │   └── Table/             # Paginação server-side (TablePagination)
│   ├── contexts/              # Contextos globais (AuthContext)
│   ├── pages/                 # Telas e módulos do sistema
│   │   ├── db-setup/          # Configuração de pasta, cadastro e login
│   │   ├── dashboard/         # KPIs, gráficos comparativos e de cartões
│   │   ├── movements/         # Extrato, filtros e modal de transações
│   │   ├── fixed-expenses/    # Despesas fixas e recorrentes
│   │   ├── categories/        # Categorias e limites mensais
│   │   └── credit-cards/      # Gestão de cartões de crédito
│   ├── routes/                # Roteamento da aplicação (AppRoutes)
│   ├── types/                 # Definições de tipos e interfaces do banco
│   ├── App.tsx                # Provedores de tema MUI e localização pt-BR
│   └── main.tsx               # Ponto de entrada do React
├── package.json
└── vite.config.ts
```

---

## 📄 Licença

Este projeto está sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE) para obter mais informações.

<div align="center">
  Desenvolvido com carinho para proporcionar autonomia e tranquilidade financeira.
</div>
