import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImportPreviewItem } from '../../../interfaces/IElectronBridge';
import { Category, CreditCard } from '../../../types/database';
import { StatusFilter, UseImportMovementsReturn } from '../types';

export function useImportMovements(): UseImportMovementsReturn {
  const [fileName, setFileName] = useState<string | null>(null);
  const [items, setItems] = useState<ImportPreviewItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [selectedCreditCardId, setSelectedCreditCardId] = useState<number | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [parsing, setParsing] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [filterText, setFilterText] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Carrega categorias e cartões de crédito ao iniciar
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (window.electronAPI) {
        const [catsRes, cardsRes] = await Promise.all([
          window.electronAPI.getCategories({ perPage: 9999 }),
          window.electronAPI.getCreditCards({ perPage: 9999 }),
        ]);

        const cats = catsRes?.data || [];
        const cards = cardsRes?.data || [];
        setCategories(cats);
        setCreditCards(cards);

        // Se houver um cartão que contenha 'Nubank' no nome, seleciona automaticamente
        const nubankCard = cards.find((c) =>
          c.description.toLowerCase().includes('nubank')
        );
        if (nubankCard) {
          setSelectedCreditCardId(nubankCard.id);
        } else if (cards.length > 0) {
          setSelectedCreditCardId(cards[0].id);
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados iniciais de importação:', err);
      setError(err?.message || 'Falha ao carregar categorias e cartões');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Atualiza o creditCardId nos itens caso o cartão selecionado mude
  const handleSetCreditCardId = (cardId: number | null) => {
    setSelectedCreditCardId(cardId);
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        creditCardId: cardId,
      }))
    );
  };

  // Faz o parse do conteúdo do arquivo CSV
  const parseContent = async (content: string, name: string) => {
    try {
      setParsing(true);
      setError(null);
      setSuccessMessage(null);

      const result = await window.electronAPI.parseImportFile({
        content,
        fileName: name,
        creditCardId: selectedCreditCardId,
      });

      setFileName(name);
      setItems(result.items);
    } catch (err: any) {
      console.error('Erro ao processar arquivo CSV:', err);
      setError(err?.message || 'Falha ao processar arquivo CSV');
    } finally {
      setParsing(false);
    }
  };

  // Seleciona arquivo via diálogo nativo
  const handleSelectFile = async () => {
    try {
      setError(null);
      const res = await window.electronAPI.selectImportFile();
      if (res.success && res.content && res.fileName) {
        await parseContent(res.content, res.fileName);
      } else if (!res.success && res.error && res.error !== 'Seleção cancelada pelo usuário') {
        setError(res.error);
      }
    } catch (err: any) {
      console.error('Erro ao selecionar arquivo:', err);
      setError(err?.message || 'Falha ao selecionar arquivo');
    }
  };

  // Recebe arquivo via Drag and Drop
  const handleDropFile = async (file: File) => {
    try {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setError('Por favor, selecione um arquivo válido no formato CSV (.csv).');
        return;
      }
      const text = await file.text();
      await parseContent(text, file.name);
    } catch (err: any) {
      console.error('Erro ao ler arquivo solto:', err);
      setError(err?.message || 'Falha ao ler arquivo');
    }
  };

  // Alterna o checkbox de um único item
  const handleToggleSelect = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  // Filtra itens com base no texto de busca e status
  const filteredItems = useMemo(() => {
    const search = filterText.trim().toLowerCase();

    return items.filter((item) => {
      // Filtro de texto
      if (search && !item.description.toLowerCase().includes(search)) {
        return false;
      }

      // Filtro de status
      switch (statusFilter) {
        case 'SELECTED':
          return item.selected;
        case 'DUPLICATES':
          return item.potentialDuplicate.isDuplicate;
        case 'UNCATEGORIZED':
          return item.categoryId === null;
        case 'INVOICE_PAYMENTS':
          return item.isInvoicePayment;
        case 'ALL':
        default:
          return true;
      }
    });
  }, [items, filterText, statusFilter]);

  // Ações de seleção em massa sobre itens visíveis
  const handleSelectAllVisible = () => {
    const visibleIds = new Set(filteredItems.map((i) => i.id));
    setItems((prev) =>
      prev.map((item) => (visibleIds.has(item.id) ? { ...item, selected: true } : item))
    );
  };

  const handleDeselectAllVisible = () => {
    const visibleIds = new Set(filteredItems.map((i) => i.id));
    setItems((prev) =>
      prev.map((item) => (visibleIds.has(item.id) ? { ...item, selected: false } : item))
    );
  };

  // Ações de seleção gerais
  const handleSelectAll = () => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: true })));
  };

  const handleDeselectAll = () => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: false })));
  };

  const handleDeselectDuplicates = () => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        selected: !item.potentialDuplicate.isDuplicate && !item.isInvoicePayment,
      }))
    );
  };

  // Altera categoria de um item individual
  const handleChangeCategory = (id: string, categoryId: number | null) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, categoryId } : item))
    );
  };

  // Aplica categoria em massa para TODOS os itens filtrados atualmente!
  const handleBulkChangeCategory = (categoryId: number | null) => {
    const visibleIds = new Set(filteredItems.map((i) => i.id));
    setItems((prev) =>
      prev.map((item) =>
        visibleIds.has(item.id) ? { ...item, categoryId } : item
      )
    );
  };

  // Reseta arquivo e volta para o Dropzone
  const handleResetFile = () => {
    setFileName(null);
    setItems([]);
    setFilterText('');
    setStatusFilter('ALL');
    setError(null);
    setSuccessMessage(null);
  };

  // Confirma e persiste as movimentações selecionadas
  const handleConfirmImport = async (): Promise<boolean> => {
    const selectedItems = items.filter((i) => i.selected);
    if (selectedItems.length === 0) {
      setError('Nenhuma transação selecionada para importação. Marque ao menos um item.');
      return false;
    }

    try {
      setImporting(true);
      setError(null);

      const payload = selectedItems.map((item) => ({
        date: item.date,
        description: item.description,
        amount: item.amount,
        type: item.type,
        categoryId: item.categoryId,
        creditCardId: selectedCreditCardId,
        notes: item.isInvoicePayment ? 'Pagamento de fatura importado' : 'Importado via extrato Nubank',
      }));

      const res = await window.electronAPI.executeImportMovements({ items: payload });
      if (res.success) {
        setSuccessMessage(
          `Importação concluída com sucesso! ${res.importedCount} movimentação(ões) foram adicionadas ao seu extrato.`
        );
        return true;
      } else {
        setError(res.error || 'Falha ao importar movimentações.');
        return false;
      }
    } catch (err: any) {
      console.error('Erro na execução do lote de importação:', err);
      setError(err?.message || 'Erro inesperado ao salvar no banco de dados.');
      return false;
    } finally {
      setImporting(false);
    }
  };

  // Estatísticas computadas
  const totalItemsCount = items.length;
  const filteredCount = filteredItems.length;
  const selectedCount = items.filter((i) => i.selected).length;
  const duplicateCount = items.filter((i) => i.potentialDuplicate.isDuplicate).length;
  const invoicePaymentCount = items.filter((i) => i.isInvoicePayment).length;
  const selectedTotalAmount = items
    .filter((i) => i.selected && i.type === 'EXPENSE')
    .reduce((acc, curr) => acc + curr.amount, 0);

  return {
    fileName,
    items,
    filteredItems,
    categories,
    creditCards,
    selectedCreditCardId,
    setSelectedCreditCardId: handleSetCreditCardId,
    loading,
    parsing,
    importing,
    error,
    successMessage,
    clearSuccessMessage: () => setSuccessMessage(null),
    filterText,
    setFilterText,
    statusFilter,
    setStatusFilter,

    totalItemsCount,
    filteredCount,
    selectedCount,
    duplicateCount,
    invoicePaymentCount,
    selectedTotalAmount,

    handleSelectFile,
    handleDropFile,
    handleToggleSelect,
    handleSelectAllVisible,
    handleDeselectAllVisible,
    handleSelectAll,
    handleDeselectAll,
    handleDeselectDuplicates,
    handleChangeCategory,
    handleBulkChangeCategory,
    handleResetFile,
    handleConfirmImport,
  };
}
