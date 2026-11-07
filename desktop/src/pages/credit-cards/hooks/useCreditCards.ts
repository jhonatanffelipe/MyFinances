import { useCallback, useEffect, useState } from 'react';
import { CreditCard } from '../../../types/database';
import { CreditCardFormData } from '../constants';

export function useCreditCards() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [orderField, setOrderField] = useState('description');
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('asc');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CreditCard | null>(null);

  const fetchCards = useCallback(
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
          const res = await window.electronAPI.getCreditCards({
            page,
            perPage: limit,
            search: searchQuery,
            orderField: field,
            orderDirection: direction,
          });
          setCards(res.data);
          setTotalRows(res.total);
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar cartões de crédito');
      } finally {
        setLoading(false);
      }
    },
    [currentPage, perPage, search, orderField, orderDirection]
  );

  useEffect(() => {
    fetchCards(currentPage, perPage, search, orderField, orderDirection);
  }, []);

  const handlePagination = useCallback(
    async (newPerPage: number, newPage: number, field: string, direction: 'asc' | 'desc') => {
      setPerPage(newPerPage);
      setCurrentPage(newPage);
      await fetchCards(newPage, newPerPage, search, field || orderField, direction || orderDirection);
    },
    [fetchCards, search, orderField, orderDirection]
  );

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(0);
    fetchCards(0, perPage, val, orderField, orderDirection);
  };

  const handleOpenCreate = () => {
    setSelectedCard(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (card: CreditCard) => {
    setSelectedCard(card);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedCard(null);
    setIsModalOpen(false);
  };

  const handleSubmitCard = async (formData: CreditCardFormData) => {
    try {
      if (!window.electronAPI) return;
      if (selectedCard) {
        await window.electronAPI.updateCreditCard(selectedCard.id, {
          description: formData.description,
          color: formData.color,
          due_day: Number(formData.due_day),
        });
      } else {
        await window.electronAPI.createCreditCard({
          description: formData.description,
          color: formData.color,
          due_day: Number(formData.due_day),
          active: 1,
        });
      }
      handleCloseModal();
      await fetchCards(currentPage, perPage, search, orderField, orderDirection);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar cartão de crédito');
    }
  };

  const handleDeleteCard = async (id: string) => {
    if (
      !window.confirm(
        'Tem certeza que deseja excluir este cartão de crédito? Os lançamentos vinculados a ele continuarão no sistema.'
      )
    ) {
      return;
    }
    try {
      if (window.electronAPI) {
        await window.electronAPI.deleteCreditCard(id);
        await fetchCards(currentPage, perPage, search, orderField, orderDirection);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir cartão de crédito');
    }
  };

  return {
    cards,
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
    loading,
    error,
    isModalOpen,
    selectedCard,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmitCard,
    handleDeleteCard,
    refetch: () => fetchCards(currentPage, perPage, search, orderField, orderDirection),
  };
}
