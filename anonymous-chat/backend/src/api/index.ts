import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { config } from "../config";
import logger from "../utils/logger";

// Import Routes
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import userRoutes from "./routes/user.routes";
import chatRoutes from "./routes/chat.routes";
import statsRoutes from "./routes/stats.routes";
import webhookRoutes from "./routes/webhook.routes";
import healthRoutes from './routes/health.routes';

// Import Middlewares
import { errorHandler } from "./middlewares/error.middleware";
import { notFoundHandler } from "./middlewares/notFound.middleware";

/**
 * تابع ساخت Express App
 */
export function createApiServer(): Express {
  const app = express();

  // 🧩 Security & Core Middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: config.api.corsOrigin || "*",
      credentials: true,
    })
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // 🧾 Logging
  if (config.env === "development") {
    app.use(morgan("dev"));
  } else {
    app.use(
      morgan("combined", {
        stream: { write: (msg) => logger.info(msg.trim()) },
      })
    );
  }

  // 🚦 Rate Limiting
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقیقه
    max: 100,
    message: "تعداد درخواست‌های شما بیش از حد مجاز است.",
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/", apiLimiter);

  // 🔍 Health Check
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "OK" });
  });

  // 📦 API Routes
  app.use('/', healthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/chats", chatRoutes);
  app.use("/api/stats", statsRoutes);
  app.use("/api/webhook", webhookRoutes);

  // ❌ 404 & Error Handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/**
 * تابع اجرای Server در حالت مستقل (در محیط مستقیم)
 */
export async function startApiServer(): Promise<void> {
  const app = createApiServer();
  const port = config.api.port || 3000;

  app.listen(port, () => {
    logger.info(`🚀 API Server started on port ${port}`);
    logger.info(`📍 Environment: ${config.env}`);
    logger.info(`🔗 Health check: http://localhost:${port}/health`);
  });
}

/**
 * برای فایل src/index.ts لازم است ای را داشته باشیم
 */
export const app = createApiServer();
