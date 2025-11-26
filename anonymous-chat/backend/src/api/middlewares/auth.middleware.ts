import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { AuthenticationError, AuthorizationError } from '../../utils/errors';
import { AuthRequest } from '../../types';

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new AuthenticationError('توکن ارسال نشده است');
    }

    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: number;
      role?: string;
    };

    req.userId = decoded.userId;
    req.user = {
      id: decoded.userId,
      role: decoded.role || 'user',
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: 'توکن نامعتبر است',
      });
    }

    if (error instanceof AuthenticationError) {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

    res.status(401).json({
      success: false,
      message: 'احراز هویت ناموفق',
    });
  }
};

export const adminMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
    res.status(403).json({
      success: false,
      message: 'دسترسی غیرمجاز',
    });
    return;
  }
  next();
};
