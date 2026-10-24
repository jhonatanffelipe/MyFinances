import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@mui/material';
import { useCreditCards } from './hooks/useCreditCards';
import { CreditCardTable } from './components/CreditCardTable';
import { CreditCardModal } from './components/CreditCardModal';

export function CreditCardsPage() {
  const {
    cards,
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
    selectedCard,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmitCard,
    handleDeleteCard,
  } = useCreditCards();

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 text-red-700 text-sm rounded-2xl border border-red-200">
          {error}
        </div>
      )}

      {/* Section Header matching Figma Screen 12 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-bold text-lg text-slate-900">Cartões Cadastrados</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gerencie cartões, acompanhe limites e acesse ações rápidas para cada item.
          </p>
        </div>
        <Button
          variant="contained"
          onClick={handleOpenCreate}
          startIcon={<Plus className="w-4 h-4" />}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl px-5 py-2.5 shadow-none normal-case"
        >
          Cadastrar cartão
        </Button>
      </div>

      {/* Table */}
      <CreditCardTable
        cards={cards}
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
        onDelete={handleDeleteCard}
      />

      {/* Modal */}
      <CreditCardModal
        open={isModalOpen}
        card={selectedCard}
        onClose={handleCloseModal}
        onSubmit={handleSubmitCard}
      />
    </div>
  );
}
