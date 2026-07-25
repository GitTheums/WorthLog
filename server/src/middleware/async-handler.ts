import type { NextFunction, Request, RequestHandler, Response } from 'express';

type RouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

export function asyncHandler(handler: RouteHandler): RequestHandler {
  return (req, res, next) => {
    try {
      const result = handler(req, res, next);
      if (result instanceof Promise) {
        void result.catch(next);
      }
    } catch (error) {
      next(error);
    }
  };
}
