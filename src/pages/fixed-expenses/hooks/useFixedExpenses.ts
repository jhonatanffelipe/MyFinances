import { useCallback, useEffect, useState } from 'react';
import { Category, CreditCard, FixedExpense } from '../../../types/database';
import { FixedExpenseFormData } from '../constants';

export function useFixedExpenses() {
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [orderField, setOrderField] = useState('due_day');
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('asc');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<FixedExpense | null>(null);

  const fetchDependencies = useCallback(async () => {
    try {
      if (window.electronAPI) {
        const [catRes, cardRes] = await Promise.all([
          window.electronAPI.getCategories({ perPage: 9999 }),
          window.electronAPI.getCreditCards({ perPage: 9999 }),
        ]);
        setCategories(catRes.data.filter((c) => c.type === 'EXPENSE'));
        setCreditCards(cardRes.data);
      }
    } catch (err: any) {
      console.error('Error fetching dependencies for fixed expenses:', err);
    }
  }, []);

  const fetchFixedExpenses = useCallback(
    async (
      page = currentPage,
      limit = perPage,
      searchQuery = search,
      field = orderField,
      direction = orderDirection
    ) => {
      try {
        setLoading(true);
        setError(null);
        if (window.electronAPI) {
          const res = await window.electronAPI.getFixedExpenses({
            page,
            perPage: limit,
            search: searchQuery,
            orderField: field,
            orderDirection: direction,
          });
          setFixedExpenses(res.data);
          setTotalRows(res.total);
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar despesas fixas');
      } finally {
        setLoading(false);
      }
    },
    [currentPage, perPage, search, orderField, orderDirection]
  );

  useEffect(() => {
    fetchDependencies();
    fetchFixedExpenses(currentPage, perPage, search, orderField, orderDirection);
  }, []);

  const handlePagination = useCallback(
    async (newPerPage: number, newPage: number, field: string, direction: 'asc' | 'desc') => {
      setPerPage(newPerPage);
      setCurrentPage(newPage);
      await fetchFixedExpenses(newPage, newPerPage, search, field || orderField, direction || orderDirection);
    },
    [fetchFixedExpenses, search, orderField, orderDirection]
  );

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(0);
    fetchFixedExpenses(0, perPage, val, orderField, orderDirection);
  };

  const handleOpenCreate = () => {
    setSelectedExpense(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (exp: FixedExpense) => {
    setSelectedExpense(exp);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedExpense(null);
    setIsModalOpen(false);
  };

  const handleSubmitExpense = async (formData: FixedExpenseFormData) => {
    try {
      if (!window.electronAPI) return;
      const payload = {
        description: formData.description,
        amount: Number(formData.amount),
        category_id: Number(formData.category_id),
        credit_card_id: formData.credit_card_id ? Number(formData.credit_card_id) : null,
        recurrence: (formData.recurrence || 'MONTHLY') as any,
        due_day: Number(formData.due_day),
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        active: formData.active ?? 1,
        notes: formData.notes || '',
      };

      if (selectedExpense) {
        await window.electronAPI.updateFixedExpense(selectedExpense.id, payload);
      } else {
        await window.electronAPI.createFixedExpense(payload);
      }
      handleCloseModal();
      await fetchFixedExpenses(currentPage, perPage, search, orderField, orderDirection);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar despesa fixa');
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (
      !window.confirm(
        'Tem certeza que deseja excluir esta despesa fixa?\nTodos os movimentos vinculados também serão removidos.'
      )
    ) {
      return;
    }
    try {
      if (window.electronAPI) {
        await window.electronAPI.deleteFixedExpense(id);
        await fetchFixedExpenses(currentPage, perPage, search, orderField, orderDirection);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir despesa fixa');
    }
  };

  return {
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
    setOrderField,
    setOrderDirection,
    handlePagination,
    handleSearchChange,
    isModalOpen,
    selectedExpense,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmitExpense,
    handleDeleteExpense,
    refetch: () => fetchFixedExpenses(currentPage, perPage, search, orderField, orderDirection),
  };
}
