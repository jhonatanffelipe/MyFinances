/** Tipos da importação de faturas CSV (Nubank e Banco Inter). */
export type ImportBankType = 'AUTO' | 'NUBANK' | 'INTER';

export interface ImportPreviewItem {
  id: string;
  /** Chave de deduplicação gravada em movements.import_hash. */
  importHash: string;
  date: string;
  originalDate?: string;
  description: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME';
  categoryId: string | null;
  creditCardId: string | null;
  isInvoicePayment: boolean;
  notes?: string;
  bank?: string;
  categoryHint?: string;
  transactionTypeHint?: string;
  potentialDuplicate: {
    isDuplicate: boolean;
    reason?: string;
    existingMovementId?: string;
    existingFixedExpenseId?: string;
  };
  selected: boolean;
}

export interface ImportParseResult {
  items: ImportPreviewItem[];
  totalCount: number;
  duplicateCount: number;
  invoicePaymentCount: number;
  totalExpense: number;
  totalIncome: number;
  fileName?: string;
  detectedBank?: ImportBankType;
}
