import { useCallback, useEffect, useRef, useState } from 'react';
import { Category, CreditCard, Movement, MovementFilters as FiltersType } from '../../../types/database';
import { MovementFormData } from '../constants';

function getCurrentMonthRange() {
  const now = new Date();
  now.setDate(1); // Evita overflow em meses com 31 dias
  now.setMonth(now.getMonth() + 1); // Mês atual mais 1
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return {
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function useMovements() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [perPage, setPerPage] = useState(25);
  const [orderField, setOrderField] = useState('date');
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('desc');

  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    incomeCount: 0,
    expenseCount: 0,
  });

  const [filters, setFilters] = useState<FiltersType>(() => {
    const { startDate, endDate } = getCurrentMonthRange();
    return {
      startDate,
      endDate,
      categoryId: undefined,
      creditCardId: undefined,
      type: 'ALL',
      search: '',
    };
  });

  // Sequência de requisições: só a resposta da última busca é aplicada na tela
  // (evita que um período maior, mais lento, sobrescreva o resultado do mês atual)
  const requestSeqRef = useRef(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);

  // Exclusão em lote de lançamentos de um cartão em um mês
  const [bulkDeleteState, setBulkDeleteState] = useState<{
    open: boolean;
    cardId: number | null;
    yearMonth: string;
  }>({ open: false, cardId: null, yearMonth: '' });

  const fetchDependencies = useCallback(async () => {
    try {
      if (window.electronAPI) {
        const [catRes, cardRes] = await Promise.all([
          window.electronAPI.getCategories({ perPage: 9999 }),
          window.electronAPI.getCreditCards({ perPage: 9999 }),
        ]);
        setCategories(catRes.data);
        setCreditCards(cardRes.data);
      }
    } catch (err: any) {
      console.error('Error fetching categories/cards:', err);
    }
  }, []);

  const fetchMovements = useCallback(
    async (
      page = currentPage,
      limit = perPage,
      field = orderField,
      direction = orderDirection,
      currentFilters = filters
    ) => {
      const requestId = ++requestSeqRef.current;
      try {
        setLoading(true);
        setError(null);
        if (window.electronAPI) {
          const res = await window.electronAPI.getMovements({
            ...currentFilters,
            page,
            perPage: limit,
            orderField: field,
            orderDirection: direction,
          });
          if (requestId !== requestSeqRef.current) return;
          setMovements(res.data);
          setTotalRows(res.total);
          if (res.summary) {
            setSummary(res.summary);
          }
        }
      } catch (err: any) {
        if (requestId !== requestSeqRef.current) return;
        setError(err.message || 'Erro ao carregar movimentações');
      } finally {
        if (requestId === requestSeqRef.current) setLoading(false);
      }
    },
    [currentPage, perPage, orderField, orderDirection, filters]
  );

  useEffect(() => {
    fetchDependencies();
  }, [fetchDependencies]);

  useEffect(() => {
    setCurrentPage(0);
    fetchMovements(0, perPage, orderField, orderDirection, filters);
  }, [filters]);

  const handlePagination = useCallback(
    async (newPerPage: number, newPage: number, field: string, direction: 'asc' | 'desc') => {
      setPerPage(newPerPage);
      setCurrentPage(newPage);
      await fetchMovements(newPage, newPerPage, field || orderField, direction || orderDirection, filters);
    },
    [fetchMovements, orderField, orderDirection, filters]
  );

  const handleFilterChange = (newFilters: FiltersType) => {
    setFilters(newFilters);
  };

  const handleOpenCreateModal = () => {
    setSelectedMovement(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (mov: Movement) => {
    setSelectedMovement(mov);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedMovement(null);
    setIsModalOpen(false);
  };

  const handleSubmitMovement = async (formData: MovementFormData) => {
    try {
      if (!window.electronAPI) return;
      if (selectedMovement) {
        await window.electronAPI.updateMovement(selectedMovement.id, {
          description: formData.description,
          amount: Number(formData.amount),
          date: formData.date,
          type: formData.type as any,
          category_id: Number(formData.category_id),
          credit_card_id: formData.credit_card_id ? Number(formData.credit_card_id) : null,
          notes: formData.notes,
        });
      } else {
        await window.electronAPI.createMovement({
          description: formData.description,
          amount: Number(formData.amount),
          date: formData.date,
          type: formData.type as any,
          category_id: Number(formData.category_id),
          credit_card_id: formData.credit_card_id ? Number(formData.credit_card_id) : null,
          notes: formData.notes,
        });
      }
      handleCloseModal();
      await fetchMovements(currentPage, perPage, orderField, orderDirection, filters);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar movimentação');
    }
  };

  const handleDeleteMovement = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta movimentação?')) {
      return;
    }
    try {
      if (window.electronAPI) {
        await window.electronAPI.deleteMovement(id);
        await fetchMovements(currentPage, perPage, orderField, orderDirection, filters);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir movimentação');
    }
  };

  /** Abre o modal de exclusão em lote; sem argumentos usa o cartão e o mês do filtro atual. */
  const handleOpenBulkDelete = (cardId?: number | null, yearMonth?: string) => {
    const filterCardId =
      typeof filters.creditCardId === 'number'
        ? filters.creditCardId
        : typeof filters.creditCardId === 'string' && /^\d+$/.test(filters.creditCardId)
          ? Number(filters.creditCardId)
          : null;
    const filterMonth =
      filters.startDate && /^\d{4}-\d{2}/.test(filters.startDate) ? filters.startDate.substring(0, 7) : '';
    setBulkDeleteState({
      open: true,
      cardId: cardId ?? filterCardId,
      yearMonth: yearMonth || filterMonth,
    });
  };

  const handleCloseBulkDelete = () => {
    setBulkDeleteState((prev) => ({ ...prev, open: false }));
  };

  const handleConfirmBulkDelete = async (creditCardId: number, yearMonth: string) => {
    if (!window.electronAPI) return;
    const res = await window.electronAPI.bulkDeleteCardMovements({ creditCardId, yearMonth });
    if (!res.success) {
      throw new Error(res.error || 'Erro ao excluir lançamentos do cartão');
    }
    await fetchMovements(currentPage, perPage, orderField, orderDirection, filters);
  };

  const netBalance = summary.totalIncome - summary.totalExpense;

  return {
    movements,
    categories,
    creditCards,
    loading,
    error,
    filters,
    setFilters: handleFilterChange,
    totalRows,
    currentPage,
    perPage,
    orderField,
    orderDirection,
    setCurrentPage,
    setPerPage,
    setOrderField,
    setOrderDirection,
    handlePagination,
    totalIncome: summary.totalIncome,
    totalExpense: summary.totalExpense,
    incomeCount: summary.incomeCount,
    expenseCount: summary.expenseCount,
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
    refetch: () => fetchMovements(currentPage, perPage, orderField, orderDirection, filters),
  };
}
