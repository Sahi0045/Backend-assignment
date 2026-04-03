import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error(`[${req.method}] ${req.path} - ${err.message}`, {
    stack: env.NODE_ENV !== 'production' ? err.stack : undefined,
    user: req.user?.id,
  });

  // Known operational errors (ApiError)
  if (err instanceof ApiError) {
    ApiResponse.error(res, err.message, err.statusCode, err.errors);
    return;
  }

  // Zod validation errors (shouldn't normally reach here due to middleware)
  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const field = e.path.join('.') || 'root';
      if (!errors[field]) errors[field] = [];
      errors[field].push(e.message);
    });
    ApiResponse.error(res, 'Validation error', 400, errors);
    return;
  }

  // Prisma errors
  if ((err as any).code) {
    const prismaCode = (err as any).code as string;

    if (prismaCode === 'P2002') {
      const field = (err as any).meta?.target?.[0] || 'field';
      ApiResponse.error(res, `A record with this ${field} already exists`, 409);
      return;
    }

    if (prismaCode === 'P2025') {
      ApiResponse.error(res, 'Record not found', 404);
      return;
    }

    if (prismaCode === 'P2003') {
      ApiResponse.error(res, 'Related record not found', 400);
      return;
    }
  }

  // Unknown errors - don't leak internals in production
  const message =
    env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again later.'
      : err.message;

  ApiResponse.error(res, message, 500);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  ApiResponse.error(
    res,
    `Route not found: ${req.method} ${req.originalUrl}`,
    404
  );
};
