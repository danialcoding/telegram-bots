// src/config/index.ts

if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN is not defined in .env file!');
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000'),
  
  bot: {
    token: process.env.BOT_TOKEN!,
    adminIds: process.env.ADMIN_IDS?.split(',').map(Number) || [],
  },

  telegram: {
    webhookUrl: process.env.WEBHOOK_URL || '',
  },

  rateLimit: {
    windowMs: 60 * 1000,
    max: 40
  },
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'chatbot',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  
  api: {
    port: parseInt(process.env.API_PORT || '4000'),
    baseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: '7d',
  },
  
  payment: {
    zarinpal: {
      merchantId: process.env.ZARINPAL_MERCHANT_ID!,
    },
    idpay: {
      apiKey: process.env.IDPAY_API_KEY!,
    },
  },
  
  session: {
    secret: process.env.SESSION_SECRET || 'your-secret-key',
  },
};
