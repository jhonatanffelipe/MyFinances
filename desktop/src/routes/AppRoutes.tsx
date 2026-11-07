import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/Layout/AppLayout';
import { useAppState } from '../contexts/AppStateContext';
import { CategoriesPage } from '../pages/categories';
import { CreditCardsPage } from '../pages/credit-cards';
import { DashboardPage } from '../pages/dashboard';
import { FixedExpensesPage, FixedIncomesPage } from '../pages/fixed-entries';
import { ImportMovementsPage } from '../pages/import-movements';
import { MembersPage } from '../pages/members';
import { MovementsPage } from '../pages/movements';
import { OnboardingGate } from '../pages/onboarding';
import { ProfilePage } from '../pages/profile';

/** Antes de "ready" (conectar, login, família) mostra o onboarding; depois, as telas do app. */
export function AppRoutes() {
  const { state } = useAppState();
  if (state.phase !== 'ready') return <OnboardingGate />;

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/movements" element={<MovementsPage />} />
          <Route path="/movements/import" element={<ImportMovementsPage />} />
          <Route path="/fixed-expenses" element={<FixedExpensesPage />} />
          <Route path="/fixed-incomes" element={<FixedIncomesPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/credit-cards" element={<CreditCardsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
