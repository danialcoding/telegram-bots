// src/index.ts
import dotenv from 'dotenv';
dotenv.config();

import redisService from './services/redis.service';
import { app } from './api/index';
import { telegramBot } from './bot/index';
import { config } from './config/index';
import logger from './utils/logger';
import db from './services/database.service';

async function start() {
  try {
    // اتصال به دیتابیس
    await db.connect();
    logger.info('✅ Database connected');

    await redisService.connect();
    logger.info('✅ Redis connected');

    // راه‌اندازی API
    const port = config.port || 3000;
    app.listen(port, () => {
      logger.info(`✅ API server running on port ${port}`);
    });

    // ✅ راه‌اندازی Bot از طریق کلاس
    await telegramBot.launch();

    // ✅ Cron job برای آفلاین کردن کاربران غیرفعال (هر 1 دقیقه)
    setInterval(async () => {
      try {
        const result = await db.query('SELECT mark_inactive_users_offline()');
        const count = result.rows[0]?.mark_inactive_users_offline || 0;
        if (count > 0) {
          logger.info(`🔄 Marked ${count} users as offline`);
        }
      } catch (error) {
        logger.error('❌ Error marking users offline:', error);
      }
    }, 60000); // هر 60 ثانیه (1 دقیقه)

  } catch (error) {
    logger.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

// خاتمه امن
process.on('SIGINT', async () => {
  logger.info('🛑 SIGINT received, shutting down...');
  await telegramBot.stop('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 SIGTERM received, shutting down...');
  await telegramBot.stop('SIGTERM');
  process.exit(0);
});

// ✅ Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection:', { reason, promise });
});

start();
