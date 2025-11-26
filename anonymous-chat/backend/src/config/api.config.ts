export const apiConfig = {
  port: process.env.API_PORT ? parseInt(process.env.API_PORT) : 3000,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 دقیقه
    max: 100, // 100 درخواست
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-here',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },

  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
};
