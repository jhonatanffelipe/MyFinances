import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@mui/material';
import { useFixedExpenses } from './hooks/useFixedExpenses';
import { FixedExpenseTable } from './components/FixedExpenseTable';
import { FixedExpenseModal } from './components/FixedExpenseModal';

export function FixedExpensesPage() {
  const {
    fixedExpenses,
    categories,
    creditCards,
    loading,
    error,
    totalRows,
    currentPage,
    perPage,
    search,
    orderField,
    orderDirection,
    setCurrentPage,
    setPerPage,
    handlePagination,
    handleSearchChange,
    isModalOpen,
    selectedExpense,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmitExpense,
    handleDeleteExpense,
  } = useFixedExpenses();

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 text-red-700 text-sm rounded-2xl border border-red-200">
          {error}
        </div>
      )}

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-bold text-lg text-slate-900">Contas Recorrentes Ativas</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Movimentos criados automaticamente para cada mês do período configurado.
          </p>
        </div>
        <Button
          variant="contained"
          onClick={handleOpenCreate}
          startIcon={<Plus className="w-4 h-4" />}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl px-5 py-2.5 shadow-none normal-case"
        >
          Nova Despesa Fixa
        </Button>
      </div>

      {/* Table */}
      <FixedExpenseTable
        fixedExpenses={fixedExpenses}
        loading={loading}
        totalRows={totalRows}
        currentPage={currentPage}
        perPage={perPage}
        search={search}
        orderField={orderField}
        orderDirection={orderDirection}
        setCurrentPage={setCurrentPage}
        setPerPage={setPerPage}
        handlePagination={handlePagination}
        handleSearchChange={handleSearchChange}
        onEdit={handleOpenEdit}
        onDelete={handleDeleteExpense}
      />

      {/* Modal */}
      <FixedExpenseModal
        open={isModalOpen}
        expense={selectedExpense}
        categories={categories}
        creditCards={creditCards}
        onClose={handleCloseModal}
        onSubmit={handleSubmitExpense}
      />
    </div>
  );
}
