import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  CalendarClock,
  Tags,
  CreditCard,
  Wallet,
  LogOut,
  FolderSync,
} from 'lucide-react';
import { Menu, MenuItem, ListItemIcon, ListItemText, CircularProgress } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { AuthPage } from '../../pages/auth';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Movimentações', path: '/movements', icon: ArrowLeftRight },
  { label: 'Despesas Fixas', path: '/fixed-expenses', icon: CalendarClock },
  { label: 'Categorias', path: '/categories', icon: Tags },
  { label: 'Cartões de Crédito', path: '/credit-cards', icon: CreditCard },
];

const PAGE_METADATA: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Dashboard',
    subtitle: 'Visão geral e monitoramento das suas finanças este mês.',
  },
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'Visão geral e monitoramento das suas finanças este mês.',
  },
  '/movements': {
    title: 'Movimentações',
    subtitle: 'Histórico completo e detalhado das transações financeiras.',
  },
  '/fixed-expenses': {
    title: 'Despesas Fixas',
    subtitle: 'Gerenciamento de contas recorrentes e compromissos mensais.',
  },
  '/categories': {
    title: 'Categorias',
    subtitle: 'Monitore limites e controle os orçamentos planejados por categoria.',
  },
  '/credit-cards': {
    title: 'Cartões de Crédito',
    subtitle: 'Gerencie seus limites de crédito, datas de fechamento, vencimento e faturas.',
  },
};

export function AppLayout() {
  const location = useLocation();
  const { dbPath, dbFile, user, loading, logout, selectFolder } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Enquanto faz a checagem inicial de status E houver chance de usuário já logado
  // (sessão em memória), exibe um spinner rápido. Caso contrário, exibe o fluxo de auth imediatamente.
  if (loading && user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <CircularProgress color="success" />
      </div>
    );
  }

  // Se nenhum banco foi configurado ou se o usuário não está autenticado, exibe a tela de Auth
  if (!dbPath || !user) {
    return <AuthPage />;
  }

  const currentPath = location.pathname;
  const pageMeta = PAGE_METADATA[currentPath] || {
    title: 'MyFinances',
    subtitle: 'Controle Financeiro Pessoal',
  };

  const handleProfileClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleChangeDbFolder = async () => {
    handleMenuClose();
    await selectFolder();
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
  };

  const userInitials = (user.name || 'Carlos Silva')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-screen w-screen bg-slate-50/60 overflow-hidden font-sans">
      {/* Left Sidebar */}
      <aside className="w-64 bg-[#0b132b] text-slate-100 flex flex-col justify-between shadow-2xl z-10 flex-shrink-0 select-none">
        <div>
          {/* Logo Header */}
          <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 flex-shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-white leading-none">
              MyFinances
            </h1>
          </div>

          {/* Navigation Links */}
          <nav className="px-4 py-2 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.path === '/'
                  ? currentPath === '/' || currentPath === '/dashboard'
                  : currentPath === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-slate-800/90 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 ${
                      isActive ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* SQLite Database Status Footer matching Figma */}
        <div className="p-4">
          <button
            onClick={handleChangeDbFolder}
            title={`Clique para trocar a pasta do banco de dados.\nCaminho: ${dbPath}`}
            className="w-full text-left bg-slate-800/60 hover:bg-slate-800 border border-slate-800/80 rounded-2xl p-3.5 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/50" />
              <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                SQLite Ativo
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-1 truncate">
              {dbFile || 'db_myfinances.sqlite'}
            </p>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header matching Figma Screen Top-Line */}
        <header className="px-8 pt-7 pb-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {pageMeta.title}
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {pageMeta.subtitle}
            </p>
          </div>

          {/* User Profile on top-right */}
          <div
            onClick={handleProfileClick}
            className="flex items-center gap-3 cursor-pointer p-1 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <span className="text-sm font-bold text-slate-800 hidden sm:inline">
              {user.name}
            </span>
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-sm ring-2 ring-emerald-500/20 select-none">
              {userInitials}
            </div>
          </div>

          {/* Profile Popover Menu */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            PaperProps={{
              className: 'rounded-2xl shadow-lg border border-slate-100 mt-1 min-w-[200px]',
            }}
          >
            <div className="px-4 py-2 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-400">Conectado como</p>
              <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
            </div>
            <MenuItem onClick={handleChangeDbFolder} className="text-xs py-2 text-slate-700">
              <ListItemIcon>
                <FolderSync className="w-4 h-4 text-slate-500" />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ className: 'text-xs font-medium' }}>
                Trocar Pasta do Banco
              </ListItemText>
            </MenuItem>
            <MenuItem onClick={handleLogout} className="text-xs py-2 text-red-600">
              <ListItemIcon>
                <LogOut className="w-4 h-4 text-red-500" />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ className: 'text-xs font-semibold text-red-600' }}>
                Encerrar Sessão
              </ListItemText>
            </MenuItem>
          </Menu>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto px-8 pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
