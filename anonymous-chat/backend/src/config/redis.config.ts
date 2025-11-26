// src/config/redis.config.ts

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  ttl: {
    online: number;        // 5 دقیقه
    session: number;       // 24 ساعت
    cache: number;         // 1 ساعت
    queue: number;         // 5 دقیقه
    rateLimit: number;     // 1 دقیقه
  };
  limits: {
    messagePerMinute: number;      // 20 پیام در دقیقه
    searchPerMinute: number;       // 10 جستجو در دقیقه
    directPerHour: number;         // 5 دایرکت در ساعت
    reportPerDay: number;          // 3 گزارش در روز
  };
}

export const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  
  ttl: {
    online: 300,        // 5 دقیقه
    session: 86400,     // 24 ساعت
    cache: 3600,        // 1 ساعت
    queue: 300,         // 5 دقیقه
    rateLimit: 60       // 1 دقیقه
  },
  
  limits: {
    messagePerMinute: 20,
    searchPerMinute: 10,
    directPerHour: 5,
    reportPerDay: 3
  }
};


console.log('🔧 Redis Config:', {
  host: redisConfig.host,
  port: redisConfig.port,
  hasPassword: !!redisConfig.password,
  db: redisConfig.db
});