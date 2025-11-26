import { Router } from "express";
import { body, param, query } from "express-validator";
import {
  authMiddleware,
  adminMiddleware,
} from "../middlewares/auth.middleware";
import { asyncHandler } from "../middlewares/error.middleware";
import { validate } from "../middlewares/validator.middleware";
import { notificationService } from '../../services/notification.service';
import statsService from "../../services/stats.service";
import reportService from "../../services/report.service";
import userService from "../../services/user.service";
import adminService from "../../services/admin.service";
import logger from '../../utils/logger';
import { pool } from '../../database/db';

const router = Router();

// اعمال middleware احراز هویت به تمام مسیرها
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * دریافت آمار داشبورد
 * GET /api/admin/dashboard
 */
router.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const stats = await statsService.getDashboardStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * دریافت گزارش‌های در انتظار
 * GET /api/admin/reports
 */
router.get(
  "/reports",
  validate([
    query("status").optional().isIn(["pending", "resolved", "rejected"]),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("offset").optional().isInt({ min: 0 }),
  ]),
  asyncHandler(async (req, res) => {
    const { status = "pending", limit = 20, offset = 0 } = req.query;

    const reports = await reportService.getReports({
      status: status as string,
      limit: Number(limit),
      offset: Number(offset),
    });

    const total = await reportService.getReportsCount(status as string);

    res.json({
      success: true,
      data: {
        reports,
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
 * حل گزارش
 * POST /api/admin/reports/:id/resolve
 */
router.post(
  "/reports/:id/resolve",
  validate([
    param("id").isInt(),
    body("action").isIn(["blocked", "warned", "rejected"]),
    body("note").optional().isString(),
  ]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { action, note } = req.body;

    await reportService.resolveReport(Number(id), action, note);

    // اگر action بلاک باشد، کاربر را بلاک کنیم
    if (action === "blocked") {
      const report = await reportService.getReportById(Number(id));
      if (report) {
        await userService.blockUser(
          report.reported_id,
          "admin",
          "گزارش تایید شده"
        );
      }
    }

    res.json({
      success: true,
      message: "گزارش با موفقیت حل شد",
    });
  })
);

/**
 * جستجوی کاربران
 * GET /api/admin/users/search
 */
router.get(
  "/users/search",
  validate([
    query("q").notEmpty().withMessage("کلمه کلیدی الزامی است"),
    query("limit").optional().isInt({ min: 1, max: 50 }),
  ]),
  asyncHandler(async (req, res) => {
    const { q, limit = 20 } = req.query;

    const users = await userService.searchUsers(q as string, Number(limit));

    res.json({
      success: true,
      data: users,
    });
  })
);

/**
 * دریافت اطلاعات کاربر
 * GET /api/admin/users/:id
 */
router.get(
  "/users/:id",
  validate([param("id").isInt()]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await userService.findById(Number(id));

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "کاربر یافت نشد",
      });
    }

    const stats = await userService.getUserStats(Number(id));

    res.json({
      success: true,
      data: {
        user,
        stats,
      },
    });
  })
);

/**
 * بلاک کردن کاربر
 * POST /api/admin/users/:id/block
 */
router.post(
  "/users/:id/block",
  validate([
    param("id").isInt(),
    body("reason").notEmpty().withMessage("دلیل بلاک الزامی است"),
    body("duration").optional().isInt(),
  ]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason, duration } = req.body;

    await userService.blockUser(
      Number(id),
      "admin",
      reason,
      duration ? Number(duration) : undefined
    );

    res.json({
      success: true,
      message: "کاربر با موفقیت بلاک شد",
    });
  })
);

/**
 * رفع بلاک کاربر
 * POST /api/admin/users/:id/unblock
 */
router.post(
  "/users/:id/unblock",
  validate([param("id").isInt()]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await userService.unblockUserByAdmin(Number(id));

    res.json({
      success: true,
      message: "بلاک کاربر برداشته شد",
    });
  })
);

/**
 * اضافه/کسر سکه
 * POST /api/admin/users/:id/coins
 */
router.post(
  "/users/:id/coins",
  validate([
    param("id").isInt(),
    body("amount").isInt(),
    body("reason").notEmpty(),
  ]),
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.id);
    const { amount, reason } = req.body;
    const adminId = req.user?.id;

    // دریافت کاربر
    const user = await userService.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "کاربر یافت نشد",
      });
    }

    // بررسی موجودی برای کسر
    if (amount < 0 && user.coins + amount < 0) {
      return res.status(400).json({
        success: false,
        message: "موجودی سکه کاربر کافی نیست",
      });
    }

    // به‌روزرسانی سکه
    const newBalance = user.coins + amount;
    await pool.query(
      "UPDATE users SET coins = $1, updated_at = NOW() WHERE id = $2",
      [newBalance, userId]
    );

    // ثبت تراکنش
    await pool.query(
      `INSERT INTO coin_transactions 
       (user_id, amount, type, reason, admin_id, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        userId,
        Math.abs(amount),
        amount > 0 ? "credit" : "debit",
        reason,
        adminId,
      ]
    );

    logger.info("Admin modified coins", {
      adminId,
      userId,
      amount,
      reason,
      newBalance,
    });

    res.json({
      success: true,
      message: `${Math.abs(amount)} سکه با موفقیت ${
        amount > 0 ? "اضافه" : "کسر"
      } شد`,
      data: {
        previousBalance: user.coins,
        newBalance,
        change: amount,
      },
    });
  })
);

/**
 * ارسال پیام همگانی
 * POST /api/admin/broadcast
 */
router.post(
  "/broadcast",
  validate([
    body("message").notEmpty(),
    body("target").optional().isIn(["all", "active", "blocked"]),
  ]),
  asyncHandler(async (req, res) => {
    const { message, target = "all" } = req.body;
    const adminId = req.user?.id;

    // دریافت لیست کاربران بر اساس target
    let usersQuery = "SELECT telegram_id FROM users WHERE is_banned = false";

    if (target === "active") {
      // کاربرانی که در ۷ روز اخیر فعال بودند
      usersQuery += " AND last_activity > NOW() - INTERVAL '7 days'";
    } else if (target === "blocked") {
      // فقط کاربران بن شده
      usersQuery = "SELECT telegram_id FROM users WHERE is_banned = true";
    }

    const usersResult = await pool.query(usersQuery);
    const telegramIds = usersResult.rows.map((u) => u.telegram_id);

    if (telegramIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "کاربری برای ارسال پیام یافت نشد",
      });
    }

    // ثبت broadcast در دیتابیس
    const broadcastResult = await pool.query(
      `INSERT INTO broadcasts 
       (admin_id, message, target, total_recipients, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())
       RETURNING id`,
      [adminId, message, target, telegramIds.length]
    );
    const broadcastId = broadcastResult.rows[0].id;

    // شروع ارسال در پس‌زمینه
    notificationService
      .broadcastMessage(telegramIds, message, broadcastId)
      .then(async (result) => {
        // به‌روزرسانی وضعیت broadcast
        await pool.query(
          `UPDATE broadcasts 
           SET status = 'completed', 
               successful_count = $1, 
               failed_count = $2,
               completed_at = NOW()
           WHERE id = $3`,
          [result.successful, result.failed, broadcastId]
        );
      })
      .catch(async (error) => {
        logger.error("Broadcast failed", { broadcastId, error });
        await pool.query(
          `UPDATE broadcasts SET status = 'failed' WHERE id = $1`,
          [broadcastId]
        );
      });

    logger.info("Broadcast started", {
      adminId,
      broadcastId,
      target,
      recipientCount: telegramIds.length,
    });

    res.json({
      success: true,
      message: "پیام همگانی در صف ارسال قرار گرفت",
      data: {
        broadcastId,
        totalRecipients: telegramIds.length,
      },
    });
  })
);

export default router;
