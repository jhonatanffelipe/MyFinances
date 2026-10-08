import { useCallback, useEffect, useState } from 'react';
import { Category } from '../../../types/database';
import { CategoryFormData } from '../constants';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [orderField, setOrderField] = useState('name');
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('asc');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const fetchCategories = useCallback(
    async (
      page = currentPage,
      limit = perPage,
      searchQuery = search,
      selectedType = typeFilter,
      field = orderField,
      direction = orderDirection
    ) => {
      try {
        setLoading(true);
        setError(null);
        if (window.electronAPI) {
          const res = await window.electronAPI.getCategories({
            page,
            perPage: limit,
            search: searchQuery,
            type: selectedType,
            orderField: field,
            orderDirection: direction,
          });
          setCategories(res.data);
          setTotalRows(res.total);
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar categorias');
      } finally {
        setLoading(false);
      }
    },
    [currentPage, perPage, search, typeFilter, orderField, orderDirection]
  );

  useEffect(() => {
    fetchCategories(currentPage, perPage, search, typeFilter, orderField, orderDirection);
  }, []);

  const handlePagination = useCallback(
    async (newPerPage: number, newPage: number, field: string, direction: 'asc' | 'desc') => {
      setPerPage(newPerPage);
      setCurrentPage(newPage);
      await fetchCategories(newPage, newPerPage, search, typeFilter, field || orderField, direction || orderDirection);
    },
    [fetchCategories, search, typeFilter, orderField, orderDirection]
  );

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(0);
    fetchCategories(0, perPage, val, typeFilter, orderField, orderDirection);
  };

  const handleTypeFilterChange = (newType: 'ALL' | 'INCOME' | 'EXPENSE') => {
    setTypeFilter(newType);
    setCurrentPage(0);
    fetchCategories(0, perPage, search, newType, orderField, orderDirection);
  };

  const handleOpenCreate = () => {
    setSelectedCategory(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setSelectedCategory(cat);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedCategory(null);
    setIsModalOpen(false);
  };

  const handleSubmitCategory = async (formData: CategoryFormData) => {
    try {
      if (!window.electronAPI) return;
      if (selectedCategory) {
        await window.electronAPI.updateCategory(selectedCategory.id, {
          name: formData.name,
          description: formData.description,
          type: formData.type as any,
          color: formData.color,
          icon: formData.icon || 'Tag',
          monthly_limit: formData.monthly_limit ? Number(formData.monthly_limit) : null,
        });
      } else {
        await window.electronAPI.createCategory({
          name: formData.name,
          description: formData.description,
          type: formData.type as any,
          color: formData.color,
          icon: formData.icon || 'Tag',
          monthly_limit: formData.monthly_limit ? Number(formData.monthly_limit) : null,
        });
      }
      handleCloseModal();
      await fetchCategories(currentPage, perPage, search, typeFilter, orderField, orderDirection);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar categoria');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (
      !window.confirm(
        'Tem certeza que deseja excluir esta categoria? As movimentações ficarão sem categoria.'
      )
    ) {
      return;
    }
    try {
      if (window.electronAPI) {
        await window.electronAPI.deleteCategory(id);
        await fetchCategories(currentPage, perPage, search, typeFilter, orderField, orderDirection);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir categoria');
    }
  };

  return {
    categories,
    totalRows,
    currentPage,
    perPage,
    search,
    typeFilter,
    orderField,
    orderDirection,
    setCurrentPage,
    setPerPage,
    setOrderField,
    setOrderDirection,
    handlePagination,
    handleSearchChange,
    handleTypeFilterChange,
    loading,
    error,
    isModalOpen,
    selectedCategory,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmitCategory,
    handleDeleteCategory,
    refetch: () => fetchCategories(currentPage, perPage, search, typeFilter, orderField, orderDirection),
  };
}
