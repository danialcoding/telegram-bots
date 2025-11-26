import { Request, Response } from 'express';

/**
 * 404 Not Found Handler
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: 'مسیر درخواستی یافت نشد',
    path: req.url,
  });
}
