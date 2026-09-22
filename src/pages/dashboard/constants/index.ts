export interface DashboardFilters {
  yearMonth: string; // YYYY-MM
}

export function getCurrentYearMonth(): string {
  const d = new Date();
  d.setDate(1); // Evita overflow em meses com 31 dias
  d.setMonth(d.getMonth() + 1); // Mês atual mais 1 (mês de referência)
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
