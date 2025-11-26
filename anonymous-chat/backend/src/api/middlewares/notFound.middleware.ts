import { Request, Response } from 'express';

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      message: 'مسیر درخواستی یافت نشد',
      code: 'NOT_FOUND',
    },
  });
};
