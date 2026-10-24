import React from 'react';
import { useMovements } from './hooks/useMovements';
import { MovementSummary } from './components/MovementSummary';
import { MovementFilters } from './components/MovementFilters';
import { MovementTable } from './components/MovementTable';
import { MovementModal } from './components/MovementModal';
import { BulkDeleteCardModal } from './components/BulkDeleteCardModal';

export function MovementsPage() {
  const {
    movements,
    categories,
    creditCards,
    loading,
    error,
    filters,
    setFilters,
    totalRows,
    currentPage,
    perPage,
    orderField,
    orderDirection,
    setCurrentPage,
    setPerPage,
    handlePagination,
    totalIncome,
    totalExpense,
    incomeCount,
    expenseCount,
    netBalance,
    isModalOpen,
    selectedMovement,
    handleOpenCreateModal,
    handleOpenEditModal,
    handleCloseModal,
    handleSubmitMovement,
    handleDeleteMovement,
    bulkDeleteState,
    handleOpenBulkDelete,
    handleCloseBulkDelete,
    handleConfirmBulkDelete,
  } = useMovements();

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 text-red-700 text-sm rounded-2xl border border-red-200">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <MovementSummary
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        netBalance={netBalance}
        incomeCount={incomeCount}
        expenseCount={expenseCount}
      />

      {/* Filters with integrated Nova Transação button */}
      <MovementFilters
        filters={filters}
        categories={categories}
        creditCards={creditCards}
        onFilterChange={setFilters}
        onOpenCreate={handleOpenCreateModal}
        onOpenBulkDelete={creditCards.length > 0 ? () => handleOpenBulkDelete() : undefined}
      />

      {/* Movement Table */}
      <MovementTable
        movements={movements}
        loading={loading}
        totalRows={totalRows}
        currentPage={currentPage}
        perPage={perPage}
        orderField={orderField}
        orderDirection={orderDirection}
        setCurrentPage={setCurrentPage}
        setPerPage={setPerPage}
        handlePagination={handlePagination}
        onEdit={handleOpenEditModal}
        onDelete={handleDeleteMovement}
        onFilterCard={(cardId) => setFilters({ ...filters, creditCardId: cardId })}
        onBulkDeleteCard={(cardId, yearMonth) => handleOpenBulkDelete(cardId, yearMonth)}
      />

      {/* Modal Form */}
      <MovementModal
        open={isModalOpen}
        movement={selectedMovement}
        categories={categories}
        creditCards={creditCards}
        onClose={handleCloseModal}
        onSubmit={handleSubmitMovement}
      />

      {/* Exclusão em lote por cartão/mês */}
      <BulkDeleteCardModal
        open={bulkDeleteState.open}
        creditCards={creditCards}
        initialCardId={bulkDeleteState.cardId}
        initialYearMonth={bulkDeleteState.yearMonth}
        onClose={handleCloseBulkDelete}
        onConfirm={handleConfirmBulkDelete}
      />
    </div>
  );
}
