import React from 'react';
import { useMovements } from './hooks/useMovements';
import { MovementSummary } from './components/MovementSummary';
import { MovementFilters } from './components/MovementFilters';
import { MovementTable } from './components/MovementTable';
import { MovementModal } from './components/MovementModal';
import { BulkDeleteCardModal } from './components/BulkDeleteCardModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';

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
    movementToDelete,
    setMovementToDelete,
    handleConfirmDeleteMovement,
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

      {/* Exclusão individual: mostra de quem é o lançamento */}
      <ConfirmDialog
        open={!!movementToDelete}
        title="Excluir lançamento?"
        confirmLabel="Excluir"
        danger
        warning="Some para todos os membros da família. Esta ação não pode ser desfeita."
        onClose={() => setMovementToDelete(null)}
        onConfirm={handleConfirmDeleteMovement}
      >
        {movementToDelete && (
          <p>
            <strong className="text-slate-900">{movementToDelete.description}</strong> ·{' '}
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(movementToDelete.amount)}
            <br />
            De <strong className="text-slate-900">{movementToDelete.member_name ?? 'membro desconhecido'}</strong>
            {movementToDelete.type === 'TRANSFER' && movementToDelete.to_member_name && (
              <>
                {' '}para <strong className="text-slate-900">{movementToDelete.to_member_name}</strong>
              </>
            )}
            .
          </p>
        )}
      </ConfirmDialog>

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
