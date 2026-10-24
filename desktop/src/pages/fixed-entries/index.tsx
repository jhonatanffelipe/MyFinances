import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@mui/material';
import { TransactionType } from '../../types/database';
import { useFixedEntries } from './hooks/useFixedEntries';
import { FixedEntryTable } from './components/FixedEntryTable';
import { FixedEntryModal } from './components/FixedEntryModal';

interface FixedEntriesViewProps {
  /** EXPENSE = Despesas Fixas | INCOME = Receitas Fixas */
  type: TransactionType;
}

/**
 * Tela genérica de lançamentos fixos. É reaproveitada pelas rotas
 * /fixed-expenses (despesas) e /fixed-incomes (receitas).
 */
export function FixedEntriesView({ type }: FixedEntriesViewProps) {
  const {
    copy,
    fixedEntries,
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
    selectedEntry,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmitEntry,
    handleDeleteEntry,
  } = useFixedEntries(type);

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
          <h2 className="font-bold text-lg text-slate-900">{copy.sectionTitle}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{copy.sectionSubtitle}</p>
        </div>
        <Button
          variant="contained"
          onClick={handleOpenCreate}
          startIcon={<Plus className="w-4 h-4" />}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl px-5 py-2.5 shadow-none normal-case"
        >
          {copy.newButton}
        </Button>
      </div>

      {/* Table */}
      <FixedEntryTable
        copy={copy}
        entries={fixedEntries}
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
        onDelete={handleDeleteEntry}
      />

      {/* Modal */}
      <FixedEntryModal
        copy={copy}
        open={isModalOpen}
        entry={selectedEntry}
        categories={categories}
        creditCards={creditCards}
        onClose={handleCloseModal}
        onSubmit={handleSubmitEntry}
      />
    </div>
  );
}

export function FixedExpensesPage() {
  return <FixedEntriesView type="EXPENSE" />;
}

export function FixedIncomesPage() {
  return <FixedEntriesView type="INCOME" />;
}
