import { AppError } from '../errors/AppError';
import { roundMoney } from '../domain/money';

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function requiredText(value: unknown, field: string, max = 200): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw AppError.validation(`${field} é obrigatório`, { field });
  if (text.length > max) throw AppError.validation(`${field} deve ter no máximo ${max} caracteres`, { field });
  return text;
}

export function optionalText(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text : null;
}

export function positiveMoney(value: unknown, field = 'Valor'): number {
  const n = roundMoney(Number(value));
  if (!Number.isFinite(n) || n <= 0) throw AppError.validation(`${field} deve ser maior que zero`, { field });
  if (n >= 1e12) throw AppError.validation(`${field} acima do limite`, { field });
  return n;
}

export function optionalMoney(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = roundMoney(Number(value));
  if (!Number.isFinite(n) || n < 0) throw AppError.validation(`${field} inválido`, { field });
  return n;
}

export function isoDate(value: unknown, field = 'Data'): string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) throw AppError.validation(`${field} inválida (AAAA-MM-DD)`, { field });
  return value;
}

export function yearMonth(value: unknown): string {
  if (typeof value !== 'string' || !YEAR_MONTH_RE.test(value)) throw AppError.validation('Mês inválido (AAAA-MM)', { field: 'yearMonth' });
  return value;
}

export function dueDay(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 31) throw AppError.validation('Dia de vencimento deve ser entre 1 e 31', { field: 'due_day' });
  return n;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (!allowed.includes(value as T)) throw AppError.validation(`${field} inválido`, { field, allowed });
  return value as T;
}
