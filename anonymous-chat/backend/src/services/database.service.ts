import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config/index';
import logger from '../utils/logger';

/**
 * Database Service - مدیریت اتصال و کوئری‌های PostgreSQL
 */
class DatabaseService {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      max: 20, // تعداد حداکثر connection
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.setupEventHandlers();
  }

  /**
   * راه‌اندازی Event Handlers برای Pool
   */
  private setupEventHandlers(): void {
    this.pool.on('connect', () => {
      logger.info('🔗 New database connection established');
    });

    this.pool.on('error', (err) => {
      logger.error('❌ Unexpected database error:', err);
    });

    this.pool.on('remove', () => {
      logger.info('🔌 Database connection removed from pool');
    });
  }

  /**
   * اتصال به دیتابیس و تست
   */
  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      
      this.isConnected = true;
      logger.info('✅ Database connected successfully at:', result.rows[0].now);
    } catch (error) {
      this.isConnected = false;
      logger.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  /**
   * قطع اتصال از دیتابیس
   */
  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('👋 Database disconnected successfully');
    } catch (error) {
      logger.error('❌ Error disconnecting database:', error);
      throw error;
    }
  }

  /**
   * اجرای کوئری ساده
   */
  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      
      logger.debug('Executed query', {
        text: text.substring(0, 100),
        duration: `${duration}ms`,
        rows: result.rowCount,
      });
      
      return result;
    } catch (error) {
      logger.error('❌ Query execution error:', {
        text,
        params,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * اجرای کوئری و برگرداندن یک سطر
   */
  async queryOne<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] || null;
  }

  /**
   * اجرای کوئری و برگرداندن چندین سطر
   */
  async queryMany<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<T[]> {
    const result = await this.query<T>(text, params);
    return result.rows;
  }

  /**
   * دریافت یک Client برای تراکنش‌ها
   */
  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  /**
   * اجرای تراکنش با callback
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('❌ Transaction rolled back:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * چک کردن وضعیت اتصال
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * دریافت آمار Pool
   */
  getPoolStats() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  /**
   * Helper: Build WHERE clause با فیلترهای داینامیک
   */
  buildWhereClause(filters: Record<string, any>): { 
    where: string; 
    params: any[] 
  } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        conditions.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    const where = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';

    return { where, params };
  }

  /**
   * Helper: Pagination
   */
  buildPagination(page: number = 1, limit: number = 20): {
    limit: number;
    offset: number;
  } {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100); // حداکثر 100
    
    return {
      limit: safeLimit,
      offset: (safePage - 1) * safeLimit,
    };
  }

  /**
   * Helper: Order By clause
   */
  buildOrderBy(
    sortBy?: string, 
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): string {
    if (!sortBy) return '';
    
    // Whitelist برای امنیت
    const allowedColumns = [
      'created_at', 
      'updated_at', 
      'id', 
      'username',
      'total_chats',
      'coins_balance',
    ];
    
    if (!allowedColumns.includes(sortBy)) {
      return 'ORDER BY created_at DESC';
    }
    
    return `ORDER BY ${sortBy} ${sortOrder}`;
  }
}

// Singleton instance
export const db = new DatabaseService();
export default db;
