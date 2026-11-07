import type { SqlParam } from '../../db/adapter';
import type { LocalStore } from '../../db/localStore';
import type { PageRequest, PaginatedResult, SortDirection } from '../../domain/types';

/** Base dos repositórios SQLite: sessão, paginação e ordenação seguras. */
export abstract class SqliteRepository {
  constructor(protected readonly store: LocalStore) {}

  protected get db() {
    return this.store.db;
  }

  protected familyId() {
    return this.store.session.current().familyId;
  }

  protected userId() {
    return this.store.session.current().userId;
  }
}

/** Escolhe o campo de ordenação só entre os permitidos (nunca interpola entrada livre no SQL). */
export function safeOrder<T extends string>(field: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(field as T) ? (field as T) : fallback;
}

export function sqlDirection(direction: SortDirection | undefined, fallback: SortDirection = 'asc') {
  return (direction ?? fallback) === 'desc' ? 'DESC' : 'ASC';
}

/** LIMIT/OFFSET quando a consulta pede página; sem `perPage`, devolve tudo. */
export function pageClause(page: PageRequest): { sql: string; params: SqlParam[] } {
  if (!page.perPage || page.perPage <= 0) return { sql: '', params: [] };
  const current = Math.max(0, page.page ?? 0);
  return { sql: ' LIMIT ? OFFSET ?', params: [page.perPage, current * page.perPage] };
}

export function toPage<T>(data: T[], total: number, page: PageRequest): PaginatedResult<T> {
  return {
    data,
    total,
    currentPage: Math.max(0, page.page ?? 0),
    perPage: page.perPage && page.perPage > 0 ? page.perPage : total,
  };
}

export const bool = (v: unknown) => v === 1 || v === true || v === '1';
export const likeParam = (search?: string) => (search ? `%${search}%` : '%');
