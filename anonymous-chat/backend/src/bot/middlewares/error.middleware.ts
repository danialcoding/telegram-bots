import { Request, Response, NextFunction } from 'express';
import logger from '../../utils/logger';

/**
 * کلاس خطای سفارشی
 */
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error Handler اصلی
 */
export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  let statusCode = 500;
  let message = 'خطای داخلی سرور';

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
  }

  // لاگ خطا
  logger.error('API Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // پاسخ به کاربر
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
    }),
  });
}

/**
 * Async Handler برای جلوگیری از try-catch تکراری
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
