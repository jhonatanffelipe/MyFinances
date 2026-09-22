import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@mui/material';
import { useCategories } from './hooks/useCategories';
import { CategoryList } from './components/CategoryList';
import { CategoryModal } from './components/CategoryModal';

export function CategoriesPage() {
  const {
    categories,
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
    selectedCategory,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmitCategory,
    handleDeleteCategory,
  } = useCategories();

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 text-red-700 text-sm rounded-2xl border border-red-200">
          {error}
        </div>
      )}

      {/* Section Header matching Figma Screen 10 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-bold text-lg text-slate-900">Categorias Cadastradas</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gerencie categorias, acompanhe limites e acesse ações rápidas para cada item.
          </p>
        </div>
        <Button
          variant="contained"
          onClick={handleOpenCreate}
          startIcon={<Plus className="w-4 h-4" />}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl px-5 py-2.5 shadow-none normal-case"
        >
          Cadastrar Categoria
        </Button>
      </div>

      {/* Categories Table View */}
      <CategoryList
        categories={categories}
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
        onDelete={handleDeleteCategory}
      />

      {/* Modal */}
      <CategoryModal
        open={isModalOpen}
        category={selectedCategory}
        onClose={handleCloseModal}
        onSubmit={handleSubmitCategory}
      />
    </div>
  );
}
