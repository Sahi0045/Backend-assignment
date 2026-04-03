import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';

type ValidationTarget = 'body' | 'query' | 'params';

export const validate = (
  schema: ZodSchema,
  target: ValidationTarget = 'body'
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const errors: Record<string, string[]> = {};

      result.error.errors.forEach((err: ZodError['errors'][number]) => {
        const field = err.path.join('.') || 'root';
        if (!errors[field]) errors[field] = [];
        errors[field].push(err.message);
      });

      return next(
        ApiError.badRequest(
          `Validation failed: ${Object.keys(errors).join(', ')}`,
          errors
        )
      );
    }

    // Replace parsed data with coerced/transformed values
    req[target] = result.data as typeof req[typeof target];
    next();
  };
};
