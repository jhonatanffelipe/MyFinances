import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { AppLayout } from '../components/Layout/AppLayout';
import { DashboardPage } from '../pages/dashboard';
import { MovementsPage } from '../pages/movements';
import { FixedExpensesPage } from '../pages/fixed-expenses';
import { CategoriesPage } from '../pages/categories';
import { CreditCardsPage } from '../pages/credit-cards';
import { ImportMovementsPage } from '../pages/import-movements';
import { AuthPage } from '../pages/auth';

export function AppRoutes() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/movements" element={<MovementsPage />} />
            <Route path="/movements/import" element={<ImportMovementsPage />} />
            <Route path="/fixed-expenses" element={<FixedExpensesPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/credit-cards" element={<CreditCardsPage />} />
            <Route path="/db-setup" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
