import { useCallback, useEffect, useState } from 'react';
import { Category, CreditCard, FixedExpense, TransactionType } from '../../../types/database';
import { FIXED_ENTRY_COPY, FixedEntryFormData } from '../constants';

/**
 * Hook compartilhado pelas telas de Despesas Fixas e Receitas Fixas.
 * O parâmetro `type` define quais registros são listados e qual tipo de
 * movimento o backend gera para o período informado.
 */
export function useFixedEntries(type: TransactionType = 'EXPENSE') {
  const copy = FIXED_ENTRY_COPY[type];

  const [fixedEntries, setFixedEntries] = useState<FixedExpense[]>([]);
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
  const [selectedEntry, setSelectedEntry] = useState<FixedExpense | null>(null);

  const fetchDependencies = useCallback(async () => {
    try {
      if (window.electronAPI) {
        const [catRes, cardRes] = await Promise.all([
          window.electronAPI.getCategories({ perPage: 9999 }),
          // Cartão de crédito só é usado em despesas
          copy.showCreditCard
            ? window.electronAPI.getCreditCards({ perPage: 9999 })
            : Promise.resolve({ data: [] as CreditCard[], total: 0, currentPage: 0, perPage: 0 }),
        ]);
        setCategories(catRes.data.filter((c) => c.type === type));
        setCreditCards(cardRes.data);
      }
    } catch (err: any) {
      console.error('Error fetching dependencies for fixed entries:', err);
    }
  }, [type, copy.showCreditCard]);

  const fetchFixedEntries = useCallback(
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
            type,
          });
          setFixedEntries(res.data);
          setTotalRows(res.total);
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar lançamentos fixos');
      } finally {
        setLoading(false);
      }
    },
    [currentPage, perPage, search, orderField, orderDirection, type]
  );

  // Recarrega do zero sempre que a tela troca de tipo (despesa <-> receita)
  useEffect(() => {
    setCurrentPage(0);
    setSearch('');
    fetchDependencies();
    fetchFixedEntries(0, perPage, '', orderField, orderDirection);
  }, [type]);

  const handlePagination = useCallback(
    async (newPerPage: number, newPage: number, field: string, direction: 'asc' | 'desc') => {
      setPerPage(newPerPage);
      setCurrentPage(newPage);
      await fetchFixedEntries(newPage, newPerPage, search, field || orderField, direction || orderDirection);
    },
    [fetchFixedEntries, search, orderField, orderDirection]
  );

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(0);
    fetchFixedEntries(0, perPage, val, orderField, orderDirection);
  };

  const handleOpenCreate = () => {
    setSelectedEntry(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (entry: FixedExpense) => {
    setSelectedEntry(entry);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedEntry(null);
    setIsModalOpen(false);
  };

  const handleSubmitEntry = async (formData: FixedEntryFormData) => {
    try {
      if (!window.electronAPI) return;
      const payload = {
        description: formData.description,
        amount: Number(formData.amount),
        type,
        category_id: Number(formData.category_id),
        credit_card_id:
          copy.showCreditCard && formData.credit_card_id ? Number(formData.credit_card_id) : null,
        recurrence: (formData.recurrence || 'MONTHLY') as any,
        due_day: Number(formData.due_day),
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        active: formData.active ?? 1,
        notes: formData.notes || '',
      };

      if (selectedEntry) {
        await window.electronAPI.updateFixedExpense(selectedEntry.id, payload);
      } else {
        await window.electronAPI.createFixedExpense(payload);
      }
      handleCloseModal();
      await fetchFixedEntries(currentPage, perPage, search, orderField, orderDirection);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar lançamento fixo');
    }
  };

  const handleDeleteEntry = async (id: number) => {
    if (!window.confirm(copy.deleteConfirm)) return;
    try {
      if (window.electronAPI) {
        await window.electronAPI.deleteFixedExpense(id);
        await fetchFixedEntries(currentPage, perPage, search, orderField, orderDirection);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir lançamento fixo');
    }
  };

  return {
    copy,
    type,
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
    setOrderField,
    setOrderDirection,
    handlePagination,
    handleSearchChange,
    isModalOpen,
    selectedEntry,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmitEntry,
    handleDeleteEntry,
    refetch: () => fetchFixedEntries(currentPage, perPage, search, orderField, orderDirection),
  };
}
