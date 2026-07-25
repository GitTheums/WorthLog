import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import {
  CategoryInUseError,
  CategoryNotFoundError,
  DatabaseError,
  SnapshotNotFoundError,
  UniqueConstraintError,
  ValidationError,
} from '../db/errors.js';
import { HttpError } from '../http/errors.js';
import { sendError } from '../http/response.js';

function zodDetails(error: ZodError): unknown {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const exposeStack = process.env['NODE_ENV'] !== 'production';

  if (error instanceof HttpError) {
    sendError(
      res,
      error.statusCode,
      error.code,
      error.message,
      error.details,
    );
    return;
  }

  if (error instanceof ZodError) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Request validation failed', zodDetails(error));
    return;
  }

  if (error instanceof CategoryInUseError) {
    sendError(res, 409, error.code, error.message);
    return;
  }

  if (
    error instanceof CategoryNotFoundError ||
    error instanceof SnapshotNotFoundError
  ) {
    sendError(res, 404, error.code, error.message);
    return;
  }

  if (error instanceof UniqueConstraintError) {
    sendError(res, 409, error.code, error.message);
    return;
  }

  if (error instanceof ValidationError) {
    sendError(res, 400, error.code, error.message);
    return;
  }

  if (error instanceof DatabaseError) {
    sendError(res, 400, error.code, error.message);
    return;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.startsWith('SQLITE_CONSTRAINT')
  ) {
    const message =
      error instanceof Error ? error.message : 'Database constraint failed';
    sendError(res, 400, 'CONSTRAINT_ERROR', message);
    return;
  }

  const message =
    error instanceof Error ? error.message : 'Unexpected server error';

  if (exposeStack) {
    console.error(error);
  }

  sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    exposeStack ? message : 'Internal server error',
  );
}
