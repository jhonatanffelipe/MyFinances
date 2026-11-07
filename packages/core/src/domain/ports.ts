import { AppError } from '../errors/AppError';
import type { Uuid } from './types';

/** Quem está usando o app e em qual família. Mutável: muda no login e no seletor de família. */
export interface Session {
  userId: Uuid;
  familyId: Uuid;
}

export interface SessionProvider {
  /** Lança NOT_AUTHENTICATED / NO_FAMILY quando não há sessão ativa. */
  current(): Session;
}

/** Sessão em memória, controlada pelo app (login, troca de família, logout). */
export class MemorySessionProvider implements SessionProvider {
  private session: Partial<Session> = {};

  set(session: Partial<Session>) {
    this.session = { ...this.session, ...session };
  }

  clear() {
    this.session = {};
  }

  current(): Session {
    if (!this.session.userId) throw new AppError('NOT_AUTHENTICATED', 'Faça login para continuar');
    if (!this.session.familyId) throw new AppError('NO_FAMILY', 'Escolha ou crie uma família');
    return { userId: this.session.userId, familyId: this.session.familyId };
  }
}

export interface Clock {
  /** Instante atual em ISO 8601 (UTC). */
  now(): string;
  /** Data local de hoje (YYYY-MM-DD). */
  today(): string;
}

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
  today: () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
};

/**
 * Gerador de uuid v4. No Node, Electron e navegador usa `crypto.randomUUID`;
 * no React Native o app injeta o `randomUUID` do expo-crypto.
 */
export type IdGenerator = () => Uuid;

export const defaultIdGenerator: IdGenerator = () => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  throw new Error('crypto.randomUUID indisponível: injete um IdGenerator');
};
