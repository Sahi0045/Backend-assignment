import rateLimit from 'express-rate-limit';
import { ApiResponse } from '../utils/ApiResponse';
import { env } from '../config/env';

export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: undefined,
  handler: (_req, res) => {
    ApiResponse.error(
      res,
      'Too many requests from this IP. Please wait before retrying.',
      429
    );
  },
  skip: () => env.NODE_ENV === 'test',
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: undefined,
  handler: (_req, res) => {
    ApiResponse.error(
      res,
      'Too many authentication attempts. Please wait 15 minutes before trying again.',
      429
    );
  },
  skip: () => env.NODE_ENV === 'test',
});
