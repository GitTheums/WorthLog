import type { Response } from 'express';

export function sendData(res: Response, data: unknown, statusCode = 200): void {
  res.status(statusCode).json({ data });
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  const body: {
    error: {
      code: string;
      message: string;
      details?: unknown;
    };
  } = {
    error: {
      code,
      message,
    },
  };

  if (details !== undefined) {
    body.error.details = details;
  }

  res.status(statusCode).json(body);
}
