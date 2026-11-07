import type { FixedExpenseRecurrence } from './types';

export const RECURRENCE_STEP: Record<FixedExpenseRecurrence, number> = {
  MONTHLY: 1,
  BIMONTHLY: 2,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
};

export const RECURRENCE_LABEL: Record<FixedExpenseRecurrence, string> = {
  MONTHLY: 'Mensal',
  BIMONTHLY: 'Bimestral',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
};

/**
 * Datas (YYYY-MM-DD) de cada ocorrência de um lançamento fixo entre o início e o fim,
 * respeitando o último dia do mês (dia 31 vira 30, 28 ou 29). Mesma regra da v1.
 */
export function fixedOccurrences(params: {
  startDate: string;
  endDate: string;
  dueDay: number;
  recurrence?: FixedExpenseRecurrence;
}): string[] {
  const step = RECURRENCE_STEP[params.recurrence || 'MONTHLY'] || 1;
  const start = new Date(params.startDate + 'T00:00:00');
  const end = new Date(params.endDate + 'T00:00:00');
  const dates: string[] = [];
  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  while (current <= end) {
    const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    const day = Math.min(params.dueDay, daysInMonth);
    const date = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (date >= params.startDate && date <= params.endDate) dates.push(date);
    current = new Date(current.getFullYear(), current.getMonth() + step, 1);
  }
  return dates;
}

/**
 * Próxima data de vencimento do cartão a partir da data mais recente da fatura
 * (se o dia passou do vencimento, vence no mês seguinte). Mesma regra da v1.
 */
export function nextCardDueDate(baseDate: string | undefined, dueDay: number | undefined, today: string): string {
  if (!dueDay || dueDay < 1 || dueDay > 31) return baseDate || today;
  const source = baseDate && /^\d{4}-\d{2}-\d{2}$/.test(baseDate) ? baseDate : today;
  let [year, month] = source.split('-').map(Number);
  const day = Number(source.split('-')[2]);
  if (day > dueDay) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  const clamped = Math.min(dueDay, new Date(year, month, 0).getDate());
  return `${year}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`;
}

/** Data de vencimento do cartão (YYYY-MM-DD) no mês de referência. */
export function cardDueDate(yearMonth: string, dueDay: number): string {
  const [y, m] = yearMonth.split('-').map((v) => parseInt(v, 10));
  const lastDay = new Date(y, m, 0).getDate();
  const day = Math.min(Math.max(dueDay || 1, 1), lastDay);
  return `${yearMonth}-${String(day).padStart(2, '0')}`;
}
