// src/services/redis.service.ts

import { createClient, RedisClientType } from "redis";
import { redisConfig } from "../config/redis.config";
import logger from "../utils/logger";

class RedisService {
  private client: RedisClientType | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      this.client = createClient({
        socket: {
          host: redisConfig.host,
          port: redisConfig.port,
        },
        password: redisConfig.password,
        database: redisConfig.db,
      });

      this.client.on("error", (err) => {
        logger.error("Redis Client Error:", err);
      });

      this.client.on("connect", () => {
        logger.info("🔄 Redis connecting...");
      });

      this.client.on("ready", () => {
        logger.info("✅ Redis ready");
      });

      await this.client.connect();
      this.isConnected = true;
      logger.info("✅ Redis connected successfully");
    } catch (error) {
      logger.error("❌ Redis connection failed:", error);
      this.client = null;
      // عدم اتصال Redis را غیرحیاتی در نظر می‌گیریم
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error("Redis GET error:", error);
      return null;
    }
  }

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    if (!this.client) return;
    try {
      if (expirySeconds) {
        await this.client.setEx(key, expirySeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.error("Redis SET error:", error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error("Redis DEL error:", error);
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.client) return 0;
    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error("Redis INCR error:", error);
      return 0;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.expire(key, seconds);
    } catch (error) {
      logger.error("Redis EXPIRE error:", error);
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.client) return -1;
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error("Redis TTL error:", error);
      return -1;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error("Redis EXISTS error:", error);
      return false;
    }
  }

  // Rate Limiting
  async checkRateLimit(
    userId: number,
    action: string
  ): Promise<{ allowed: boolean; remaining: number }> {
    // ✅ تغییر تایپ
    const limits: Record<string, { max: number; window: number }> = {
      message: { max: 120, window: 60 },
      search: { max: 30, window: 60 },
      direct: { max: 60, window: 3600 },
      report: { max: 30, window: 86400 },
      start: { max: 20, window: 60 },
      command: { max: 80, window: 60 },
    };

    const limit = limits[action];

    if (!limit) {
      logger.warn(`⚠️ Unknown rate limit action: ${action}`);
      return { allowed: true, remaining: 999 }; // ✅ object برمی‌گردانیم
    }

    const { max, window } = limit;
    const key = `rate_limit:${action}:${userId}`;

    try {
      // ✅ چک کن client وجود داره
      if (!this.client) {
        logger.error("Redis client is not connected");
        return { allowed: true, remaining: 999 };
      }

      const current = await this.client.incr(key);

      if (current === 1) {
        await this.client.expire(key, window);
      }

      const remaining = Math.max(0, max - current);

      return {
        allowed: current <= max,
        remaining,
      };
    } catch (error) {
      logger.error("Redis rate limit check error:", error);
      return { allowed: true, remaining: 999 };
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      logger.info("Redis disconnected");
    }
  }

  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }
}

export const redisService = new RedisService();
export default redisService;
