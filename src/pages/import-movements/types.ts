import { ImportBankType, ImportPreviewItem } from '../../interfaces/IElectronBridge';
import { Category, CreditCard } from '../../types/database';

export type StatusFilter = 'ALL' | 'SELECTED' | 'DUPLICATES' | 'UNCATEGORIZED' | 'INVOICE_PAYMENTS';

export interface UseImportMovementsReturn {
  fileName: string | null;
  items: ImportPreviewItem[];
  filteredItems: ImportPreviewItem[];
  categories: Category[];
  creditCards: CreditCard[];
  selectedCreditCardId: number | null;
  setSelectedCreditCardId: (id: number | null) => void;
  bankType: ImportBankType;
  setBankType: (type: ImportBankType) => void;
  detectedBank: ImportBankType | null;
  invoiceDate: string;
  setInvoiceDate: (date: string) => void;
  loading: boolean;
  parsing: boolean;
  importing: boolean;
  error: string | null;
  successMessage: string | null;
  clearSuccessMessage: () => void;
  filterText: string;
  setFilterText: (text: string) => void;
  excludeText: string;
  setExcludeText: (text: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (status: StatusFilter) => void;

  // Estatísticas computadas
  totalItemsCount: number;
  filteredCount: number;
  selectedCount: number;
  duplicateCount: number;
  invoicePaymentCount: number;
  selectedTotalAmount: number;

  // Ações
  handleSelectFile: () => Promise<void>;
  handleDropFile: (file: File) => Promise<void>;
  handleToggleSelect: (id: string) => void;
  handleSelectAllVisible: () => void;
  handleDeselectAllVisible: () => void;
  handleSelectAll: () => void;
  handleDeselectAll: () => void;
  handleDeselectDuplicates: () => void;
  handleChangeCategory: (id: string, categoryId: number | null) => void;
  handleChangeItemDate: (id: string, newDate: string) => void;
  handleBulkChangeCategory: (categoryId: number | null) => void;
  handleResetFile: () => void;
  handleConfirmImport: () => Promise<boolean>;
}

