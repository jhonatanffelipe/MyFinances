import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImportBankType, ImportPreviewItem } from '../../../interfaces/IElectronBridge';
import { Category, CreditCard } from '../../../types/database';
import { StatusFilter, UseImportMovementsReturn } from '../types';

/**
 * Calcula a próxima data de vencimento de um cartão a partir de uma data base
 * (ou da data mais recente das transações) e do dia de vencimento.
 */
export function getNextCardDueDate(baseDateStr?: string, dueDay?: number): string {
  if (!dueDay || dueDay < 1 || dueDay > 31) {
    return baseDateStr || new Date().toISOString().slice(0, 10);
  }

  let year: number;
  let month: number; // 1-12
  let day: number;

  if (baseDateStr && /^\d{4}-\d{2}-\d{2}$/.test(baseDateStr)) {
    const parts = baseDateStr.split('-').map(Number);
    year = parts[0];
    month = parts[1];
    day = parts[2];
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
    day = now.getDate();
  }

  // Se o dia da transação for posterior ao dia de vencimento, o vencimento é no mês seguinte
  if (day > dueDay) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  // Garante que o dia não passe do número de dias no mês
  const daysInMonth = new Date(year, month, 0).getDate();
  const clampedDay = Math.min(dueDay, daysInMonth);

  const mm = String(month).padStart(2, '0');
  const dd = String(clampedDay).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function useImportMovements(): UseImportMovementsReturn {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawFileContent, setRawFileContent] = useState<string | null>(null);
  const [items, setItems] = useState<ImportPreviewItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [selectedCreditCardId, setSelectedCreditCardId] = useState<number | null>(null);
  const [bankType, setBankType] = useState<ImportBankType>('AUTO');
  const [detectedBank, setDetectedBank] = useState<ImportBankType | null>(null);
  const [invoiceDate, setInvoiceDate] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [parsing, setParsing] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [filterText, setFilterText] = useState<string>('');
  const [excludeText, setExcludeText] = useState<string>('');
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

  // Atualiza o creditCardId nos itens e recalcula a data de vencimento caso o cartão selecionado mude
  const handleSetCreditCardId = (cardId: number | null) => {
    setSelectedCreditCardId(cardId);
    const card = creditCards.find((c) => c.id === cardId);

    if (card?.due_day && items.length > 0) {
      const validDates = items
        .map((i) => i.originalDate || i.date)
        .filter((d): d is string => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d)))
        .sort();
      const latestTxDate = validDates.length > 0 ? validDates[validDates.length - 1] : undefined;
      const newDueDate = getNextCardDueDate(latestTxDate, card.due_day);
      setInvoiceDate(newDueDate);
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          creditCardId: cardId,
          date: newDueDate,
        }))
      );
    } else {
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          creditCardId: cardId,
        }))
      );
    }
  };

  // Atualiza a data de vencimento/movimentações para todos os itens em lote
  const handleSetInvoiceDate = (newDate: string) => {
    setInvoiceDate(newDate);
    if (newDate) {
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          date: newDate,
        }))
      );
    } else {
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          date: item.originalDate || item.date,
        }))
      );
    }
  };

  // Atualiza a data de um único item individualmente
  const handleChangeItemDate = (id: string, newDate: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, date: newDate } : item))
    );
  };

  // Faz o parse do conteúdo do arquivo CSV
  const parseContent = async (content: string, name: string, bankToUse: ImportBankType = bankType) => {
    try {
      setParsing(true);
      setError(null);
      setSuccessMessage(null);
      setRawFileContent(content);

      const result = await window.electronAPI.parseImportFile({
        content,
        fileName: name,
        creditCardId: selectedCreditCardId,
        bankType: bankToUse,
      });

      setFileName(name);
      const effectiveBank = result.detectedBank || (bankToUse !== 'AUTO' ? bankToUse : 'NUBANK');
      setDetectedBank(effectiveBank);

      // Auto-seleciona cartão de crédito caso encontre pelo nome do banco
      let autoCardId = selectedCreditCardId;
      if (effectiveBank === 'INTER') {
        const interCard = creditCards.find((c) =>
          c.description.toLowerCase().includes('inter')
        );
        if (interCard) {
          autoCardId = interCard.id;
          setSelectedCreditCardId(interCard.id);
        }
      } else if (effectiveBank === 'NUBANK') {
        const nubankCard = creditCards.find((c) =>
          c.description.toLowerCase().includes('nubank')
        );
        if (nubankCard) {
          autoCardId = nubankCard.id;
          setSelectedCreditCardId(nubankCard.id);
        }
      }

      // Calcula a data de vencimento do cartão
      const targetCard = creditCards.find((c) => c.id === autoCardId);
      const validDates = result.items
        .map((i) => i.date || i.originalDate)
        .filter((d): d is string => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d)))
        .sort();
      const latestTxDate = validDates.length > 0 ? validDates[validDates.length - 1] : undefined;

      let calculatedDueDate = '';
      if (targetCard?.due_day) {
        calculatedDueDate = getNextCardDueDate(latestTxDate, targetCard.due_day);
      } else {
        // Fallback: se o nome do arquivo contém a data de vencimento (ex: Nubank_2026-10-08.csv)
        const dateMatch = name.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          calculatedDueDate = dateMatch[1];
        }
      }

      if (calculatedDueDate) {
        setInvoiceDate(calculatedDueDate);
        setItems(
          result.items.map((item) => ({
            ...item,
            creditCardId: autoCardId,
            date: calculatedDueDate,
            originalDate: item.originalDate || item.date,
          }))
        );
      } else {
        setInvoiceDate('');
        setItems(
          result.items.map((item) => ({
            ...item,
            creditCardId: autoCardId,
            originalDate: item.originalDate || item.date,
          }))
        );
      }
    } catch (err: any) {
      console.error('Erro ao processar arquivo CSV:', err);
      setError(err?.message || 'Falha ao processar arquivo CSV');
    } finally {
      setParsing(false);
    }
  };

  const handleSetBankType = async (newBank: ImportBankType) => {
    setBankType(newBank);
    if (rawFileContent && fileName) {
      await parseContent(rawFileContent, fileName, newBank);
    }
  };

  // Seleciona arquivo via diálogo nativo
  const handleSelectFile = async () => {
    try {
      setError(null);
      const res = await window.electronAPI.selectImportFile();
      if (res.success && res.content && res.fileName) {
        await parseContent(res.content, res.fileName, bankType);
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
      await parseContent(text, file.name, bankType);
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

  // Filtra itens com base no texto de busca, exclusão e status
  const filteredItems = useMemo(() => {
    const search = filterText.trim().toLowerCase();
    const exclude = excludeText.trim().toLowerCase();

    return items.filter((item) => {
      // Filtro de texto (inclusão)
      if (search && !item.description.toLowerCase().includes(search)) {
        return false;
      }

      // Filtro de texto (exclusão)
      if (exclude && item.description.toLowerCase().includes(exclude)) {
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
  }, [items, filterText, excludeText, statusFilter]);

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
    setRawFileContent(null);
    setDetectedBank(null);
    setItems([]);
    setInvoiceDate('');
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

      const payload = selectedItems.map((item) => {
        const finalDate = item.date || invoiceDate;
        let note = item.notes || (item.isInvoicePayment ? 'Pagamento de fatura importado' : 'Importado via fatura');

        if (item.originalDate && item.originalDate !== finalDate) {
          const parts = item.originalDate.split('-');
          const origFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : item.originalDate;
          note = `Compra realizada em ${origFormatted} | ${note}`;
        }

        return {
          date: finalDate,
          description: item.description,
          amount: item.amount,
          type: item.type,
          categoryId: item.categoryId,
          creditCardId: selectedCreditCardId,
          notes: note,
        };
      });

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
    bankType,
    setBankType: handleSetBankType,
    detectedBank,
    invoiceDate,
    setInvoiceDate: handleSetInvoiceDate,
    loading,
    parsing,
    importing,
    error,
    successMessage,
    clearSuccessMessage: () => setSuccessMessage(null),
    filterText,
    setFilterText,
    excludeText,
    setExcludeText,
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
    handleChangeItemDate,
    handleBulkChangeCategory,
    handleResetFile,
    handleConfirmImport,
  };
}
