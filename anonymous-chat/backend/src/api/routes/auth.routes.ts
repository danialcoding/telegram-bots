import { Router } from "express";
import { body } from "express-validator";
import jwt, { SignOptions, Secret } from "jsonwebtoken";
import { config } from "../../config";
import { adminService } from "../../services/admin.service";
import { asyncHandler } from "../middlewares/error.middleware";
import { validate } from "../middlewares/validator.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import logger from "../../utils/logger";
import { pool } from "../../database/db";
import bcrypt from "bcrypt";

const router = Router();

/**
 * لاگین ادمین
 * POST /api/auth/login
 */
router.post(
  "/login",
  validate([
    body("username").notEmpty().withMessage("نام کاربری الزامی است"),
    body("password").notEmpty().withMessage("رمز عبور الزامی است"),
  ]),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    // بررسی اعتبار
    const admin = await adminService.validateCredentials(username, password);

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "نام کاربری یا رمز عبور اشتباه است",
      });
    }

    // تولید توکن
    const payload = { userId: admin.id ?? admin.user_id, role: "admin" };
    const secret: Secret = config.jwt.secret as string;
    const options: SignOptions = { expiresIn: config.jwt.expiresIn ?? "7d" };

    const token = jwt.sign(payload, secret, options);
    // const token = jwt.sign(
    //   { userId: admin.user_id, role: 'admin' },
    //   config.jwt.secret,
    //   { expiresIn: config.jwt.expiresIn }
    // );

    // بروزرسانی آخرین ورود
    await adminService.updateLastLogin(admin.user_id);

    logger.info("Admin logged in:", { userId: admin.user_id });

    res.json({
      success: true,
      message: "ورود موفقیت‌آمیز",
      data: {
        token,
        admin: {
          id: admin.user_id,
          username: admin.username,
          role: admin.role,
        },
      },
    });
  })
);

/**
 * تغییر رمز عبور
 * POST /api/auth/change-password
 */
router.post(
  "/change-password",
  authMiddleware,
  validate([
    body("currentPassword").notEmpty().withMessage("رمز فعلی الزامی است"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("رمز جدید باید حداقل ۶ کاراکتر باشد"),
  ]),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "احراز هویت نشده",
      });
    }

    // دریافت رمز فعلی کاربر
    const userResult = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "کاربر یافت نشد",
      });
    }

    const user = userResult.rows[0];

    // بررسی رمز فعلی
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: "رمز فعلی اشتباه است",
      });
    }

    // هش کردن رمز جدید
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // به‌روزرسانی رمز
    await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [newPasswordHash, userId]
    );

    logger.info("Password changed", { userId });

    res.json({
      success: true,
      message: "رمز عبور با موفقیت تغییر یافت",
    });
  })
);

export default router;
