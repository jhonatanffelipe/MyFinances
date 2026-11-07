/**
 * Erro de negócio com código estável. A UI decide a mensagem pelo `code`;
 * o `message` é o texto padrão em português.
 */
export type AppErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'NOT_AUTHENTICATED'
  | 'NO_FAMILY'
  | 'NOT_MEMBER'
  | 'FORBIDDEN'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_IN_USE'
  | 'INVITE_INVALID'
  | 'PAIRING_EXPIRED'
  | 'PAIRING_DENIED'
  | 'PAIRING_USED'
  | 'CONFLICT'
  | 'SCHEMA_OUTDATED'
  | 'SCHEMA_MISSING'
  | 'PROJECT_PAUSED'
  | 'OFFLINE'
  | 'INVALID_CONNECTION'
  | 'SECRET_KEY_REJECTED';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: AppErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }

  static validation(message: string, details?: Record<string, unknown>) {
    return new AppError('VALIDATION', message, details);
  }

  static notFound(entity: string, id: string) {
    return new AppError('NOT_FOUND', `${entity} não encontrado(a)`, { entity, id });
  }

  static is(err: unknown, code?: AppErrorCode): err is AppError {
    return err instanceof AppError && (code === undefined || err.code === code);
  }
}
