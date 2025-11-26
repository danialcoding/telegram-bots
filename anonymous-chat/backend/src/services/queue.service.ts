// src/services/queue.service.ts
import { redis } from '../utils/redis';
import { query } from '../database/db';
import { CustomError } from '../utils/errors';
import { coinService } from './coin.service';

export type QueueType = 'random' | 'male' | 'female';

export interface QueueEntry {
  userId: number;
  gender: 'male' | 'female';
  joinedAt: number;
}

export interface MatchResult {
  matched: boolean;
  partnerId?: number;
  queueType?: QueueType;
}

export class QueueService {
  
  private readonly QUEUE_KEYS = {
    random: 'queue:random',
    male: 'queue:gender:male',
    female: 'queue:gender:female'
  };
  
  private readonly QUEUE_TTL = 300; // 5 دقیقه
  
  /**
   * اضافه کردن کاربر به صف رندم
   */
  async joinRandomQueue(userId: number): Promise<MatchResult> {
    // بررسی چت فعال
    const hasActiveChat = await this.hasActiveChat(userId);
    if (hasActiveChat) {
      throw new CustomError('شما در حال چت هستید. ابتدا چت فعلی را پایان دهید.', 400);
    }
    
    // بررسی در صف بودن
    const inQueue = await this.isInAnyQueue(userId);
    if (inQueue) {
      throw new CustomError('شما در صف انتظار هستید.', 400);
    }
    
    // دریافت جنسیت کاربر
    const gender = await this.getUserGender(userId);
    
    // جستجوی پارتنر در صف
    const partner = await this.findPartnerInQueue(this.QUEUE_KEYS.random, userId);
    
    if (partner) {
      // حذف پارتنر از صف و شروع چت
      await redis.zrem(this.QUEUE_KEYS.random, partner.toString());
      return { matched: true, partnerId: partner, queueType: 'random' };
    }
    
    // اضافه به صف با اطلاعات کاربر
    const entry: QueueEntry = {
      userId,
      gender,
      joinedAt: Date.now()
    };
    
    await redis.zadd(this.QUEUE_KEYS.random, Date.now(), userId.toString());
    await redis.set(`queue:user:${userId}`, JSON.stringify(entry), this.QUEUE_TTL);
    
    return { matched: false };
  }
  
  /**
   * اضافه کردن کاربر به صف جنسیتی
   */
  async joinGenderQueue(
    userId: number, 
    targetGender: 'male' | 'female'
  ): Promise<MatchResult> {
    // بررسی چت فعال
    const hasActiveChat = await this.hasActiveChat(userId);
    if (hasActiveChat) {
      throw new CustomError('شما در حال چت هستید. ابتدا چت فعلی را پایان دهید.', 400);
    }
    
    // بررسی در صف بودن
    const inQueue = await this.isInAnyQueue(userId);
    if (inQueue) {
      throw new CustomError('شما در صف انتظار هستید.', 400);
    }
    
    // دریافت جنسیت کاربر
    const userGender = await this.getUserGender(userId);
    
    // محاسبه و بررسی هزینه
    const cost = targetGender === 'female' ? 2 : 1;
    const balance = await coinService.getBalance(userId);
    
    if (balance < cost) {
      throw new CustomError(`موجودی کافی نیست. هزینه: ${cost} سکه، موجودی: ${balance} سکه`, 400);
    }
    
    // انتخاب صف مناسب
    // کاربر به صف جنسیت مخالف می‌رود تا با جنس مورد نظر خود مچ شود
    const queueKey = targetGender === 'male' 
      ? this.QUEUE_KEYS.female  // اگر دنبال پسر می‌گردد، به صف دخترهای منتظر پسر می‌رود
      : this.QUEUE_KEYS.male;   // اگر دنبال دختر می‌گردد، به صف پسرهای منتظر دختر می‌رود
    
    // جستجوی پارتنر در صف جنس هدف
    const targetQueueKey = targetGender === 'male' 
      ? this.QUEUE_KEYS.male 
      : this.QUEUE_KEYS.female;
    
    const partner = await this.findGenderPartnerInQueue(targetQueueKey, userId, targetGender);
    
    if (partner) {
      // کسر هزینه از هر دو طرف
      await coinService.deductCoins(
        userId, 
        cost, 
        `اتصال جنسیتی به ${targetGender === 'female' ? 'دختر' : 'پسر'}`
      );
      
      // حذف پارتنر از صف
      await redis.zrem(targetQueueKey, partner.toString());
      await redis.del(`queue:user:${partner}`);
      
      return { 
        matched: true, 
        partnerId: partner, 
        queueType: targetGender 
      };
    }
    
    // اضافه به صف
    const entry: QueueEntry = {
      userId,
      gender: userGender,
      joinedAt: Date.now()
    };
    
    // به صف جنسیت خودش اضافه می‌شود
    const selfQueueKey = userGender === 'male' 
      ? this.QUEUE_KEYS.male 
      : this.QUEUE_KEYS.female;
    
    await redis.zadd(selfQueueKey, Date.now(), userId.toString());
    await redis.set(`queue:user:${userId}`, JSON.stringify(entry), this.QUEUE_TTL);
    await redis.set(`queue:user:${userId}:target`, targetGender, this.QUEUE_TTL);
    
    return { matched: false };
  }
  
  /**
   * پیدا کردن پارتنر در صف رندم
   */
  private async findPartnerInQueue(queueKey: string, excludeUserId: number): Promise<number | null> {
    // دریافت اولین کاربر در صف (FIFO)
    const members = await redis.zrange(queueKey, 0, 10);
    
    for (const memberId of members) {
      const id = parseInt(memberId);
      if (id !== excludeUserId) {
        return id;
      }
    }
    
    return null;
  }
  
  /**
   * پیدا کردن پارتنر در صف جنسیتی
   */
  private async findGenderPartnerInQueue(
    queueKey: string, 
    excludeUserId: number,
    targetGender: 'male' | 'female'
  ): Promise<number | null> {
    const members = await redis.zrange(queueKey, 0, 50);
    
    for (const memberId of members) {
      const id = parseInt(memberId);
      if (id === excludeUserId) continue;
      
      // بررسی جنسیت پارتنر
      const partnerGender = await this.getUserGender(id);
      if (partnerGender === targetGender) {
        // بررسی که پارتنر هم دنبال جنس مخالف است
        const partnerTarget = await redis.get(`queue:user:${id}:target`);
        const userGender = await this.getUserGender(excludeUserId);
        
        if (partnerTarget === userGender) {
          return id;
        }
      }
    }
    
    return null;
  }
  
  /**
   * حذف کاربر از تمام صف‌ها
   */
  async removeFromAllQueues(userId: number): Promise<void> {
    await Promise.all([
      redis.zrem(this.QUEUE_KEYS.random, userId.toString()),
      redis.zrem(this.QUEUE_KEYS.male, userId.toString()),
      redis.zrem(this.QUEUE_KEYS.female, userId.toString()),
      redis.del(`queue:user:${userId}`),
      redis.del(`queue:user:${userId}:target`)
    ]);
  }
  
  /**
   * بررسی در صف بودن کاربر
   */
  async isInAnyQueue(userId: number): Promise<boolean> {
    const [inRandom, inMale, inFemale] = await Promise.all([
      redis.zscore(this.QUEUE_KEYS.random, userId.toString()),
      redis.zscore(this.QUEUE_KEYS.male, userId.toString()),
      redis.zscore(this.QUEUE_KEYS.female, userId.toString())
    ]);
    
    return inRandom !== null || inMale !== null || inFemale !== null;
  }
  
  /**
   * دریافت وضعیت صف کاربر
   */
  async getQueueStatus(userId: number): Promise<{
    inQueue: boolean;
    queueType: QueueType | null;
    position: number;
    waitTime: number;
  }> {
    for (const [type, key] of Object.entries(this.QUEUE_KEYS)) {
      const score = await redis.zscore(key, userId.toString());
      if (score !== null) {
        const position = await redis.zrank(key, userId.toString());
        return {
          inQueue: true,
          queueType: type as QueueType,
          position: (position || 0) + 1,
          waitTime: Math.floor((Date.now() - score) / 1000)
        };
      }
    }
    
    return {
      inQueue: false,
      queueType: null,
      position: 0,
      waitTime: 0
    };
  }
  
  /**
   * دریافت آمار صف‌ها
   */
  async getQueueStats(): Promise<{
    random: number;
    male: number;
    female: number;
    total: number;
  }> {
    const [random, male, female] = await Promise.all([
      redis.zcard(this.QUEUE_KEYS.random),
      redis.zcard(this.QUEUE_KEYS.male),
      redis.zcard(this.QUEUE_KEYS.female)
    ]);
    
    return {
      random,
      male,
      female,
      total: random + male + female
    };
  }
  
  /**
   * پاکسازی صف‌های منقضی شده
   */
  async cleanupExpiredEntries(): Promise<number> {
    const expireTime = Date.now() - (this.QUEUE_TTL * 1000);
    let removed = 0;
    
    for (const key of Object.values(this.QUEUE_KEYS)) {
      const count = await redis.zremrangebyscore(key, 0, expireTime);
      removed += count;
    }
    
    return removed;
  }
  
  /**
   * بررسی چت فعال
   */
  private async hasActiveChat(userId: number): Promise<boolean> {
    const result = await query(
      `SELECT id FROM chats 
       WHERE (user1_id = $1 OR user2_id = $1) AND status = 'active'`,
      [userId]
    );
    return result.rows.length > 0;
  }
  
  /**
   * دریافت جنسیت کاربر
   */
  private async getUserGender(userId: number): Promise<'male' | 'female'> {
    const result = await query(
      'SELECT gender FROM profiles WHERE user_id = $1',
      [userId]
    );
    
    if (!result.rows[0]?.gender) {
      throw new CustomError('لطفاً ابتدا پروفایل خود را تکمیل کنید.', 400);
    }
    
    return result.rows[0].gender;
  }
  
  /**
   * دریافت لیست کاربران در صف (برای ادمین)
   */
  async getQueueUsers(queueType: QueueType): Promise<Array<{
    userId: number;
    gender: string;
    waitTime: number;
  }>> {
    const key = this.QUEUE_KEYS[queueType];
    const members = await redis.zrangeWithScores(key, 0, -1);
    
    const users = [];
    for (const { member, score } of members) {
      const userId = parseInt(member);
      const gender = await this.getUserGender(userId).catch(() => 'unknown');
      
      users.push({
        userId,
        gender,
        waitTime: Math.floor((Date.now() - score) / 1000)
      });
    }
    
    return users;
  }
}

export const queueService = new QueueService();
