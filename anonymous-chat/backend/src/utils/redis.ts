// src/utils/redis.ts
import Redis from "ioredis";
import { config } from "../config";

class RedisClient {
  private client: Redis;
  private readonly ONLINE_TTL = 300; // 5 دقیقه
  private readonly ONLINE_SET_KEY = "users:online";

  constructor() {
    this.client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.client.on("connect", () => {
      console.log("✅ Redis connected successfully");
    });

    this.client.on("error", (err) => {
      console.error("❌ Redis error:", err);
    });

    this.client.on("reconnecting", () => {
      console.log("🔄 Redis reconnecting...");
    });
  }

  // ==================== USER ONLINE STATUS ====================

  /**
   * تنظیم کاربر به عنوان آنلاین
   */
  async setUserOnline(userId: number): Promise<void> {
    const timestamp = Date.now();
    await Promise.all([
      // اضافه به ست آنلاین‌ها با score زمانی
      this.client.zadd(this.ONLINE_SET_KEY, timestamp, userId.toString()),
      // تنظیم کلید جداگانه با TTL
      this.client.setex(
        `user:${userId}:online`,
        this.ONLINE_TTL,
        timestamp.toString()
      ),
    ]);
  }

  /**
   * بررسی آنلاین بودن کاربر
   */
  async isUserOnline(userId: number): Promise<boolean> {
    const exists = await this.client.exists(`user:${userId}:online`);
    return exists === 1;
  }

  /**
   * حذف وضعیت آنلاین کاربر (لاگ‌اوت)
   */
  async setUserOffline(userId: number): Promise<void> {
    await Promise.all([
      this.client.zrem(this.ONLINE_SET_KEY, userId.toString()),
      this.client.del(`user:${userId}:online`),
    ]);
  }

  /**
   * دریافت لیست تمام کاربران آنلاین
   */
  async getOnlineUsers(): Promise<number[]> {
    // حذف کاربران منقضی شده
    const expireTime = Date.now() - this.ONLINE_TTL * 1000;
    await this.client.zremrangebyscore(this.ONLINE_SET_KEY, 0, expireTime);

    // دریافت لیست
    const userIds = await this.client.zrange(this.ONLINE_SET_KEY, 0, -1);
    return userIds.map((id) => parseInt(id));
  }

  /**
   * تعداد کاربران آنلاین
   */
  async getOnlineCount(): Promise<number> {
    const expireTime = Date.now() - this.ONLINE_TTL * 1000;
    await this.client.zremrangebyscore(this.ONLINE_SET_KEY, 0, expireTime);
    return await this.client.zcard(this.ONLINE_SET_KEY);
  }

  /**
   * آخرین زمان فعالیت کاربر
   */
  async getLastActivity(userId: number): Promise<number | null> {
    const timestamp = await this.client.get(`user:${userId}:online`);
    return timestamp ? parseInt(timestamp) : null;
  }

  // ==================== QUEUE MANAGEMENT ====================
  /**
   * حذف کاربر از تمام صف‌ها
   */
  async removeFromQueue(userId: number): Promise<void> {
    const userIdStr = userId.toString();

    await Promise.all([
      // حذف از صف رندوم
      this.client.zrem("queue:random", userIdStr),

      // حذف از صف جنسیت‌ها
      this.client.zrem("queue:gender:male", userIdStr),
      this.client.zrem("queue:gender:female", userIdStr),

      // حذف کلیدهای مربوط به target
      this.client.del(`queue:user:${userId}:target`),

      // حذف از کلید شخصی
      this.client.del(`queue:user:${userId}`),
    ]);
  }

  /**
   * بررسی اینکه آیا کاربر در صف است
   */
  async isInQueue(userId: number): Promise<boolean> {
    const userIdStr = userId.toString();

    const results = await Promise.all([
      this.client.zscore("queue:random", userIdStr),
      this.client.zscore("queue:gender:male", userIdStr),
      this.client.zscore("queue:gender:female", userIdStr),
    ]);

    return results.some((score) => score !== null);
  }

  /**
   * اضافه کردن به صف (sorted set با timestamp)
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    return await this.client.zadd(key, score, member);
  }

  /**
   * حذف از صف
   */
  async zrem(key: string, member: string): Promise<number> {
    return await this.client.zrem(key, member);
  }

  /**
   * دریافت محدوده از صف (بر اساس رتبه)
   */
  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.client.zrange(key, start, stop);
  }

  /**
   * دریافت محدوده با score
   */
  async zrangeWithScores(
    key: string,
    start: number,
    stop: number
  ): Promise<Array<{ member: string; score: number }>> {
    const results = await this.client.zrange(key, start, stop, "WITHSCORES");
    const formatted: Array<{ member: string; score: number }> = [];

    for (let i = 0; i < results.length; i += 2) {
      formatted.push({
        member: results[i],
        score: parseFloat(results[i + 1]),
      });
    }

    return formatted;
  }

  /**
   * دریافت رتبه عضو در صف
   */
  async zrank(key: string, member: string): Promise<number | null> {
    return await this.client.zrank(key, member);
  }

  /**
   * دریافت score عضو
   */
  async zscore(key: string, member: string): Promise<number | null> {
    const score = await this.client.zscore(key, member);
    return score ? parseFloat(score) : null;
  }

  /**
   * تعداد اعضای صف
   */
  async zcard(key: string): Promise<number> {
    return await this.client.zcard(key);
  }

  /**
   * حذف محدوده بر اساس score
   */
  async zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string
  ): Promise<number> {
    return await this.client.zremrangebyscore(key, min, max);
  }

  // ==================== KEY-VALUE OPERATIONS ====================

  /**
   * تنظیم کلید با مقدار
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * دریافت مقدار کلید
   */
  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  /**
   * حذف کلید
   */
  async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  /**
   * بررسی وجود کلید
   */
  async exists(key: string): Promise<number> {
    return await this.client.exists(key);
  }

  /**
   * تنظیم TTL برای کلید
   */
  async expire(key: string, seconds: number): Promise<number> {
    return await this.client.expire(key, seconds);
  }

  /**
   * دریافت TTL کلید
   */
  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  // ==================== HASH OPERATIONS ====================

  /**
   * تنظیم فیلد در هش
   */
  async hset(key: string, field: string, value: string): Promise<number> {
    return await this.client.hset(key, field, value);
  }

  /**
   * دریافت فیلد از هش
   */
  async hget(key: string, field: string): Promise<string | null> {
    return await this.client.hget(key, field);
  }

  /**
   * تنظیم چند فیلد در هش
   */
  async hmset(key: string, data: Record<string, string>): Promise<string> {
    return await this.client.hmset(key, data);
  }

  /**
   * دریافت تمام فیلدهای هش
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    return await this.client.hgetall(key);
  }

  /**
   * حذف فیلد از هش
   */
  async hdel(key: string, field: string): Promise<number> {
    return await this.client.hdel(key, field);
  }

  /**
   * بررسی وجود فیلد در هش
   */
  async hexists(key: string, field: string): Promise<number> {
    return await this.client.hexists(key, field);
  }

  // ==================== LIST OPERATIONS ====================

  /**
   * اضافه کردن به انتهای لیست
   */
  async rpush(key: string, value: string): Promise<number> {
    return await this.client.rpush(key, value);
  }

  /**
   * اضافه کردن به ابتدای لیست
   */
  async lpush(key: string, value: string): Promise<number> {
    return await this.client.lpush(key, value);
  }

  /**
   * برداشتن از انتهای لیست
   */
  async rpop(key: string): Promise<string | null> {
    return await this.client.rpop(key);
  }

  /**
   * برداشتن از ابتدای لیست
   */
  async lpop(key: string): Promise<string | null> {
    return await this.client.lpop(key);
  }

  /**
   * دریافت محدوده از لیست
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.client.lrange(key, start, stop);
  }

  /**
   * طول لیست
   */
  async llen(key: string): Promise<number> {
    return await this.client.llen(key);
  }

  // ==================== SET OPERATIONS ====================

  /**
   * اضافه کردن به ست
   */
  async sadd(key: string, member: string): Promise<number> {
    return await this.client.sadd(key, member);
  }

  /**
   * حذف از ست
   */
  async srem(key: string, member: string): Promise<number> {
    return await this.client.srem(key, member);
  }

  /**
   * بررسی عضویت در ست
   */
  async sismember(key: string, member: string): Promise<number> {
    return await this.client.sismember(key, member);
  }

  /**
   * دریافت تمام اعضای ست
   */
  async smembers(key: string): Promise<string[]> {
    return await this.client.smembers(key);
  }

  /**
   * تعداد اعضای ست
   */
  async scard(key: string): Promise<number> {
    return await this.client.scard(key);
  }

  // ==================== CHAT SESSION ====================

  /**
   * ذخیره وضعیت چت فعال کاربر
   */
  async setActiveChat(userId: number, chatId: number): Promise<void> {
    await this.client.setex(
      `user:${userId}:active_chat`,
      3600, // 1 ساعت
      chatId.toString()
    );
  }

  /**
   * دریافت چت فعال کاربر
   */
  async getActiveChat(userId: number): Promise<number | null> {
    const chatId = await this.client.get(`user:${userId}:active_chat`);
    return chatId ? parseInt(chatId) : null;
  }

  /**
   * حذف چت فعال کاربر
   */
  async removeActiveChat(userId: number): Promise<void> {
    await this.client.del(`user:${userId}:active_chat`);
  }

  // ==================== RATE LIMITING ====================

  /**
   * بررسی و اعمال محدودیت نرخ (Rate Limit)
   */
  async checkRateLimit(
    key: string,
    limit: number,
    window: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    const windowKey = `ratelimit:${key}:${Math.floor(now / (window * 1000))}`;

    const count = await this.client.incr(windowKey);

    if (count === 1) {
      await this.client.expire(windowKey, window);
    }

    const ttl = await this.client.ttl(windowKey);

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: now + ttl * 1000,
    };
  }

  // ==================== CACHING ====================

  /**
   * ذخیره کش با JSON
   */
  async cacheSet(key: string, data: any, ttl: number = 3600): Promise<void> {
    await this.client.setex(`cache:${key}`, ttl, JSON.stringify(data));
  }

  /**
   * دریافت کش
   */
  async cacheGet<T = any>(key: string): Promise<T | null> {
    const data = await this.client.get(`cache:${key}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * حذف کش
   */
  async cacheDel(key: string): Promise<void> {
    await this.client.del(`cache:${key}`);
  }

  /**
   * حذف کش‌های با الگو
   */
  async cacheDelPattern(pattern: string): Promise<number> {
    const keys = await this.client.keys(`cache:${pattern}`);
    if (keys.length === 0) return 0;
    return await this.client.del(...keys);
  }

  // ==================== BLOCKED USERS ====================

  /**
   * بلاک کردن کاربر توسط کاربر دیگر
   */
  async blockUser(userId: number, blockedUserId: number): Promise<void> {
    await this.client.sadd(`user:${userId}:blocked`, blockedUserId.toString());
  }

  /**
   * آنبلاک کردن کاربر
   */
  async unblockUser(userId: number, blockedUserId: number): Promise<void> {
    await this.client.srem(`user:${userId}:blocked`, blockedUserId.toString());
  }

  /**
   * بررسی بلاک بودن
   */
  async isBlocked(userId: number, checkUserId: number): Promise<boolean> {
    const blocked = await this.client.sismember(
      `user:${userId}:blocked`,
      checkUserId.toString()
    );
    return blocked === 1;
  }

  /**
   * دریافت لیست بلاک شده‌ها
   */
  async getBlockedUsers(userId: number): Promise<number[]> {
    const blocked = await this.client.smembers(`user:${userId}:blocked`);
    return blocked.map((id) => parseInt(id));
  }

  // ==================== NOTIFICATIONS ====================

  /**
   * اضافه کردن نوتیفیکیشن
   */
  async addNotification(userId: number, notification: any): Promise<void> {
    await this.client.lpush(
      `user:${userId}:notifications`,
      JSON.stringify(notification)
    );
    // نگه داشتن حداکثر 50 نوتیفیکیشن
    await this.client.ltrim(`user:${userId}:notifications`, 0, 49);
  }

  /**
   * دریافت نوتیفیکیشن‌ها
   */
  async getNotifications(userId: number, limit: number = 10): Promise<any[]> {
    const notifications = await this.client.lrange(
      `user:${userId}:notifications`,
      0,
      limit - 1
    );
    return notifications.map((n) => JSON.parse(n));
  }

  /**
   * پاک کردن نوتیفیکیشن‌ها
   */
  async clearNotifications(userId: number): Promise<void> {
    await this.client.del(`user:${userId}:notifications`);
  }

  // ==================== STATISTICS ====================

  /**
   * افزایش شمارنده
   */
  async incrementCounter(key: string, amount: number = 1): Promise<number> {
    return await this.client.incrby(key, amount);
  }

  /**
   * کاهش شمارنده
   */
  async decrementCounter(key: string, amount: number = 1): Promise<number> {
    return await this.client.decrby(key, amount);
  }

  /**
   * دریافت شمارنده
   */
  async getCounter(key: string): Promise<number> {
    const value = await this.client.get(key);
    return value ? parseInt(value) : 0;
  }

  // ==================== UTILITY ====================

  /**
   * اجرای دستور دلخواه
   */
  async executeCommand(command: string, ...args: any[]): Promise<any> {
    return await this.client.call(command, ...args);
  }

  /**
   * دریافت اطلاعات سرور
   */
  async getInfo(): Promise<string> {
    return await this.client.info();
  }

  /**
   * پاک کردن تمام دیتابیس
   */
  async flushAll(): Promise<void> {
    await this.client.flushall();
  }

  /**
   * پاک کردن دیتابیس فعلی
   */
  async flushDb(): Promise<void> {
    await this.client.flushdb();
  }

  /**
   * بستن اتصال
   */
  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  /**
   * دریافت کلاینت خام برای عملیات پیشرفته
   */
  getClient(): Redis {
    return this.client;
  }

  // ==================== TRANSACTION ====================

  /**
   * شروع تراکنش (Pipeline)
   */
  pipeline(): ReturnType<Redis["pipeline"]> {
    return this.client.pipeline();
  }

  /**
   * شروع Multi (Transaction)
   */
  multi(): ReturnType<Redis["multi"]> {
    return this.client.multi();
  }
}

// ایجاد نمونه سینگلتون
export const redis = new RedisClient();

// توابع کمکی برای کلیدها
export const RedisKeys = {
  // User
  userOnline: (userId: number) => `user:${userId}:online`,
  userActiveChat: (userId: number) => `user:${userId}:active_chat`,
  userBlocked: (userId: number) => `user:${userId}:blocked`,
  userNotifications: (userId: number) => `user:${userId}:notifications`,

  // Queue
  queueRandom: () => "queue:random",
  queueMale: () => "queue:gender:male",
  queueFemale: () => "queue:gender:female",
  queueUser: (userId: number) => `queue:user:${userId}`,
  queueUserTarget: (userId: number) => `queue:user:${userId}:target`,

  // Chat
  chatMessages: (chatId: number) => `chat:${chatId}:messages`,
  chatTyping: (chatId: number, userId: number) =>
    `chat:${chatId}:typing:${userId}`,

  // Cache
  cache: (key: string) => `cache:${key}`,
  profileCache: (userId: number) => `cache:profile:${userId}`,
  statsCache: (type: string) => `cache:stats:${type}`,

  // Rate Limit
  rateLimit: (identifier: string) => `ratelimit:${identifier}`,

  // Stats
  statsOnlineUsers: () => "users:online",
  statsDailyUsers: (date: string) => `stats:daily:users:${date}`,
  statsDailyChats: (date: string) => `stats:daily:chats:${date}`,

  // Session
  session: (token: string) => `session:${token}`,
  adminSession: (token: string) => `admin:session:${token}`,
};

// تایپ‌ها برای TypeScript
export type RedisKeyType = keyof typeof RedisKeys;
