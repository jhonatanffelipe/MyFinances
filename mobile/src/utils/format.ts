const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatCurrency(value: number | null | undefined) {
  return currency.format(Number(value || 0));
}

/** Valor com sinal conforme o tipo: "+ R$ 10,00" ou "- R$ 10,00". */
export function signedCurrency(value: number, type: 'INCOME' | 'EXPENSE') {
  return `${type === 'INCOME' ? '+' : '-'} ${formatCurrency(value)}`;
}

/** Converte o texto digitado num campo de dinheiro (apenas dígitos = centavos) em número. */
export function centsTextToNumber(text: string) {
  const digits = text.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) / 100 : 0;
}

export function numberToMoneyText(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "2026-10-05" → "05/10/2026" */
export function isoToBr(iso?: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function dateToIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isoToDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function relativeTime(iso?: string | null) {
  if (!iso) return 'nunca';
  const diff = Date.now() - Date.parse(iso);
  if (diff < 60_000) return 'agora há pouco';
  const min = Math.round(diff / 60_000);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dia(s)`;
}
