import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

/**
 * Middleware برای اعتبارسنجی
 */
export function validate(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // اجرای تمام اعتبارسنجی‌ها
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);

    if (errors.isEmpty()) {
      return next();
    }

    // فرمت خطاها
    const formattedErrors = errors.array().map((error) => ({
      field: error.type === 'field' ? error.path : undefined,
      message: error.msg,
    }));

    res.status(400).json({
      success: false,
      message: 'خطای اعتبارسنجی',
      errors: formattedErrors,
    });
  };
}
