/** Mês de referência padrão do app: mês atual + 1 (mesma regra do desktop). */
export function defaultYearMonth(): string {
  const now = new Date();
  now.setDate(1);
  now.setMonth(now.getMonth() + 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function resolveYearMonth(target?: string) {
  const base = target && /^\d{4}-\d{2}$/.test(target) ? target : defaultYearMonth();
  const year = parseInt(base.split('-')[0], 10);
  const month = parseInt(base.split('-')[1], 10);
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const lastDay = new Date(year, month, 0).getDate();
  return {
    year,
    month,
    yearMonth,
    start: `${yearMonth}-01`,
    end: `${yearMonth}-${String(lastDay).padStart(2, '0')}`,
    lastDay,
  };
}

/** Soma (ou subtrai) meses de um YYYY-MM. */
export function shiftYearMonth(yearMonth: string, delta: number): string {
  const { year, month } = resolveYearMonth(yearMonth);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function percentChange(current: number, previous: number): number {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTHS_LONG = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function monthShortLabel(month: number) {
  return MONTHS_SHORT[month - 1] || String(month);
}

export function yearMonthLabel(yearMonth: string) {
  const { year, month } = resolveYearMonth(yearMonth);
  return `${MONTHS_LONG[month - 1]} de ${year}`;
}

/** "2026-10-05" → "05 Out 2026" */
export function formatDate(dateStr?: string | null) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d} ${MONTHS_SHORT[parseInt(m, 10) - 1] || m} ${y}`;
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
