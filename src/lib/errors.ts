/**
 * Structured application error class.
 *
 * Replaces the previous pattern of `throw new Error(JSON.stringify(...))` which
 * required round-trip parsing in global handlers.
 */

import type { OperationType } from '../utils/errorHandling';

export interface AppErrorDetails {
  operationType?: OperationType;
  path?: string | null;
  code?: string;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly operationType?: OperationType;
  public readonly path?: string | null;
  public readonly code?: string;
  public readonly cause?: unknown;

  constructor(message: string, details: AppErrorDetails = {}) {
    super(message);
    this.name = 'AppError';
    this.operationType = details.operationType;
    this.path = details.path;
    this.code = details.code;
    this.cause = details.cause;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
