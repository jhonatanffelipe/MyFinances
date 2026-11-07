import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Wallet,
  LayoutDashboard,
  ArrowLeftRight,
  CalendarCheck2,
  CalendarPlus,
  Tags,
  CreditCard as CreditCardIcon,
  LogOut,
  User,
  Users,
} from 'lucide-react';
import { Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { useAppState } from '../../contexts/AppStateContext';
import { PairingApprovalDialog } from '../Devices/PairingApprovalDialog';
import { MemberAvatar } from '../Members/MemberAvatar';
import { SyncIndicator } from '../Sync/SyncIndicator';
import { FamilySwitcher } from './FamilySwitcher';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Movimentações', path: '/movements', icon: ArrowLeftRight },
  { label: 'Despesas Fixas', path: '/fixed-expenses', icon: CalendarCheck2 },
  { label: 'Receitas Fixas', path: '/fixed-incomes', icon: CalendarPlus },
  { label: 'Categorias', path: '/categories', icon: Tags },
  { label: 'Cartões de Crédito', path: '/credit-cards', icon: CreditCardIcon },
  { label: 'Membros', path: '/members', icon: Users },
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
  '/profile': {
    title: 'Meu perfil',
    subtitle: 'Seus dados, senha, aparelhos conectados e a conexão com o banco.',
  },
  '/members': {
    title: 'Membros',
    subtitle: 'Quem participa da família, convites e acessos.',
  },
  '/movements': {
    title: 'Movimentações',
    subtitle: 'Histórico completo e detalhado das transações financeiras.',
  },
  '/movements/import': {
    title: 'Importar Fatura / Extrato',
    subtitle: 'Conciliação inteligente e importação de lançamentos via planilha CSV.',
  },
  '/fixed-expenses': {
    title: 'Despesas Fixas',
    subtitle: 'Gerenciamento de contas recorrentes e compromissos mensais.',
  },
  '/fixed-incomes': {
    title: 'Receitas Fixas',
    subtitle: 'Gerenciamento de entradas recorrentes e recebimentos mensais.',
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
  const navigate = useNavigate();
  const { state, dataVersion, requestSignOut } = useAppState();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const user = state.user!;

  const currentPath = location.pathname;
  const pageMeta = PAGE_METADATA[currentPath] || {
    title: 'MyFinances',
    subtitle: 'Controle Financeiro da Família',
  };

  const handleProfileClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    requestSignOut().catch((err) => console.error('[logout]', err));
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50/60 overflow-hidden font-sans">
      {/* Left Sidebar */}
      <aside className="w-64 bg-[#0b132b] text-slate-100 flex flex-col justify-between shadow-2xl z-10 flex-shrink-0 select-none">
        <div className="min-h-0 overflow-y-auto">
          {/* Logo Header */}
          <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 flex-shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-white leading-none">
              MyFinances
            </h1>
          </div>

          <FamilySwitcher />

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

        {/* Rodapé da barra lateral: perfil + sincronização */}
        <div className="p-4 space-y-2">
          {/* User profile pill matching reference UI */}
          <Link
            to="/profile"
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/90 border border-slate-700/50 transition-all group"
            title="Meu perfil"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <MemberAvatar name={user.name} avatarUrl={user.avatar_url} size={36} className="ring-2 ring-emerald-500/30" />
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                  {user.name}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  Meu perfil
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleLogout();
              }}
              title="Encerrar Sessão"
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700/60 rounded-lg transition-colors flex-shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </Link>

          <SyncIndicator />
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
            <MemberAvatar name={user.name} avatarUrl={user.avatar_url} size={40} className="ring-2 ring-emerald-500/20 shadow-sm" />
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
            <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2.5">
              <MemberAvatar name={user.name} avatarUrl={user.avatar_url} size={32} />
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-400">Conectado como</p>
                <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
              </div>
            </div>
            <MenuItem
              onClick={() => {
                handleMenuClose();
                navigate('/profile');
              }}
              className="text-xs py-2 text-slate-700"
            >
              <ListItemIcon>
                <User className="w-4 h-4 text-emerald-600" />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ className: 'text-xs font-semibold text-slate-800' }}>
                Meu Perfil
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
        <main className="flex-1 overflow-y-auto px-8 pb-8 pt-2">
          {!state.online && (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-2.5 text-xs text-slate-600">
              Você está offline. Pode continuar usando normalmente: as alterações ficam neste computador e sobem quando a internet voltar.
            </div>
          )}
          {/* A key recarrega a página quando chegam dados de outro aparelho ou a família muda */}
          <Outlet key={`${state.activeFamilyId}:${dataVersion}`} />
        </main>
      </div>
      <PairingApprovalDialog />
    </div>
  );
}
