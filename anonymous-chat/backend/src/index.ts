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
