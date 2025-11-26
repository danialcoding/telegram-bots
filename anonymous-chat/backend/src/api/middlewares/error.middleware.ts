import { Request, Response, NextFunction } from 'express';
import logger from '../../utils/logger';
import { CustomError } from '../../utils/errors';

export const asyncHandler =
  <T extends Request = Request>(
    fn: (req: T, res: Response, next: NextFunction) => Promise<any>
  ) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };

export const errorHandler = (
  err: Error | CustomError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof CustomError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
      },
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: {
      message: 'خطای داخلی سرور',
      code: 'INTERNAL_SERVER_ERROR',
    },
  });
};
