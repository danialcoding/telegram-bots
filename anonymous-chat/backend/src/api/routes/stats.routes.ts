import { Router } from 'express';
import { query } from 'express-validator';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { validate } from '../middlewares/validator.middleware';
import statsService from '../../services/stats.service';

const router = Router();

// اعمال middleware احراز هویت
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * آمار کلی سیستم
 * GET /api/stats/overview
 */
router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const stats = await statsService.getSystemStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * آمار کاربران
 * GET /api/stats/users
 */
router.get(
  '/users',
  validate([
    query('period').optional().isIn(['day', 'week', 'month', 'year']),
  ]),
  asyncHandler(async (req, res) => {
    const { period = 'month' } = req.query;

    const stats = await statsService.getUserStats(period as string);

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * آمار چت‌ها
 * GET /api/stats/chats
 */
router.get(
  '/chats',
  validate([
    query('period').optional().isIn(['day', 'week', 'month', 'year']),
  ]),
  asyncHandler(async (req, res) => {
    const { period = 'month' } = req.query;

    const stats = await statsService.getChatStatsByPeriod(period as string);

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * آمار درآمد و سکه
 * GET /api/stats/revenue
 */
router.get(
  '/revenue',
  validate([
    query('period').optional().isIn(['day', 'week', 'month', 'year']),
  ]),
  asyncHandler(async (req, res) => {
    const { period = 'month' } = req.query;

    const stats = await statsService.getRevenueStats(period as string);

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * آمار جغرافیایی
 * GET /api/stats/geography
 */
router.get(
  '/geography',
  asyncHandler(async (req, res) => {
    const stats = await statsService.getGeographyStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * آمار فعالیت روزانه
 * GET /api/stats/activity
 */
router.get(
  '/activity',
  validate([
    query('days').optional().isInt({ min: 1, max: 90 }),
  ]),
  asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;

    const stats = await statsService.getDailyActivity(Number(days));

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * آمار گزارش‌ها
 * GET /api/stats/reports
 */
router.get(
  '/reports',
  asyncHandler(async (req, res) => {
    const stats = await statsService.getReportStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * نمودار کاربران جدید
 * GET /api/stats/charts/new-users
 */
router.get(
  '/charts/new-users',
  validate([
    query('days').optional().isInt({ min: 7, max: 90 }),
  ]),
  asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;

    const data = await statsService.getNewUsersChart(Number(days));

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * نمودار چت‌ها
 * GET /api/stats/charts/chats
 */
router.get(
  '/charts/chats',
  validate([
    query('days').optional().isInt({ min: 7, max: 90 }),
  ]),
  asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;

    const data = await statsService.getChatsChart(Number(days));

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * آمار پرفروش‌ترین پکیج‌ها
 * GET /api/stats/top-packages
 */
router.get(
  '/top-packages',
  asyncHandler(async (req, res) => {
    const stats = await statsService.getTopPackages();

    res.json({
      success: true,
      data: stats,
    });
  })
);

export default router;
