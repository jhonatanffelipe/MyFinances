export function resolveYearMonth(target?: string) {
  const now = new Date();
  const year = target ? parseInt(target.split('-')[0], 10) : now.getFullYear();
  const month = target ? parseInt(target.split('-')[1], 10) : now.getMonth() + 1;
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

export function percentChange(current: number, previous: number): number {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}
