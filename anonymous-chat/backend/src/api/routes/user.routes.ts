import { Router } from 'express';
import { param, query } from 'express-validator';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { validate } from '../middlewares/validator.middleware';
import userService from '../../services/user.service';
import chatService from '../../services/chat.service';

const router = Router();

// اعمال middleware احراز هویت
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * لیست کاربران با فیلتر و صفحه‌بندی
 * GET /api/users
 */
router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['active', 'blocked', 'deleted']),
    query('gender').optional().isIn(['male', 'female']),
    query('sort').optional().isIn(['created_at', 'last_active', 'coins']),
    query('order').optional().isIn(['asc', 'desc']),
  ]),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      status,
      gender,
      sort = 'created_at',
      order = 'desc',
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const users = await userService.getUsers({
      limit: Number(limit),
      offset,
      status: status as string,
      gender: gender as string,
      sortBy: sort as string,
      order: order as string,
    });

    const total = await userService.getUsersCount({
      status: status as string,
      gender: gender as string,
    });

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  })
);

/**
 * دریافت اطلاعات کامل کاربر
 * GET /api/users/:id
 */
router.get(
  '/:id',
  validate([param('id').isInt()]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await userService.findById(Number(id));

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'کاربر یافت نشد',
      });
    }

    const profile = await userService.getProfile(Number(id));
    const stats = await userService.getUserStats(Number(id));

    res.json({
      success: true,
      data: {
        user,
        profile,
        stats,
      },
    });
  })
);

/**
 * تاریخچه چت‌های کاربر
 * GET /api/users/:id/chats
 */
router.get(
  '/:id/chats',
  validate([
    param('id').isInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('offset').optional().isInt({ min: 0 }),
  ]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const chats = await chatService.getUserChatHistory(
      Number(id),
      Number(limit),
      Number(offset)
    );

    const total = await chatService.getUserChatCount(Number(id));

    res.json({
      success: true,
      data: {
        chats,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
        },
      },
    });
  })
);

/**
 * تراکنش‌های کاربر
 * GET /api/users/:id/transactions
 */
router.get(
  '/:id/transactions',
  validate([
    param('id').isInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('offset').optional().isInt({ min: 0 }),
  ]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const transactions = await userService.getTransactionHistory(
      Number(id),
      Number(limit),
      Number(offset)
    );

    const total = await userService.getTransactionCount(Number(id));

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
        },
      },
    });
  })
);

/**
 * گزارش‌های ثبت شده توسط کاربر
 * GET /api/users/:id/reports
 */
router.get(
  '/:id/reports',
  validate([param('id').isInt()]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const reports = await userService.getUserReports(Number(id));

    res.json({
      success: true,
      data: reports,
    });
  })
);

/**
 * فعالیت‌های اخیر کاربر
 * GET /api/users/:id/activities
 */
router.get(
  '/:id/activities',
  validate([
    param('id').isInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    const activities = await userService.getUserActivities(
      Number(id),
      Number(limit)
    );

    res.json({
      success: true,
      data: activities,
    });
  })
);

export default router;
