/** Tipos da importação de faturas (iguais aos do desktop, IElectronBridge.ts). */
export type ImportBankType = 'AUTO' | 'NUBANK' | 'INTER';

export interface ImportPreviewItem {
  id: string;
  date: string;
  originalDate?: string;
  description: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME';
  categoryId: number | null;
  creditCardId: number | null;
  isInvoicePayment: boolean;
  notes?: string;
  bank?: string;
  categoryHint?: string;
  transactionTypeHint?: string;
  potentialDuplicate: {
    isDuplicate: boolean;
    reason?: string;
    existingMovementId?: number;
    existingFixedExpenseId?: number;
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
