// src/services/stats.service.ts
import { query } from '../database/db';
import { redis } from '../utils/redis';

export interface DashboardStats {
  users: {
    total: number;
    active: number;
    blocked: number;
    online: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  profiles: {
    total: number;
    complete: number;
    male: number;
    female: number;
  };
  chats: {
    total: number;
    active: number;
    endedToday: number;
    averageDuration: number;
    totalMessages: number;
  };
  coins: {
    totalCirculating: number;
    totalEarned: number;
    totalSpent: number;
    transactionsToday: number;
  };
  reports: {
    total: number;
    pending: number;
    resolved: number;
    todayReports: number;
  };
  referrals: {
    totalReferrals: number;
    successfulReferrals: number;
    topReferrers: Array<{ userId: number; username: string; count: number }>;
  };
}

export interface ChartData {
  labels: string[];
  data: number[];
}

export class StatsService {
  
  /**
   * دریافت آمار کامل داشبورد
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const [users, profiles, chats, coins, reports, referrals] = await Promise.all([
      this.getUserStats(),
      this.getProfileStats(),
      this.getChatStats(),
      this.getCoinStats(),
      this.getReportStats(),
      this.getReferralStats()
    ]);
    
    return { users, profiles, chats, coins, reports, referrals };
  }
  
  /**
   * آمار کاربران
   */
  private async getUserStats() {
    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = TRUE) as active,
        COUNT(*) FILTER (WHERE is_blocked = TRUE) as blocked,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as new_today,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as new_this_week,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_this_month
      FROM users
    `);
    
    const onlineUsers = await redis.getOnlineUsers();
    
    return {
      total: parseInt(result.rows[0].total),
      active: parseInt(result.rows[0].active),
      blocked: parseInt(result.rows[0].blocked),
      online: onlineUsers.length,
      newToday: parseInt(result.rows[0].new_today),
      newThisWeek: parseInt(result.rows[0].new_this_week),
      newThisMonth: parseInt(result.rows[0].new_this_month)
    };
  }
  
  /**
   * آمار پروفایل‌ها
   */
  private async getProfileStats() {
    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE name IS NOT NULL AND gender IS NOT NULL AND age IS NOT NULL) as complete,
        COUNT(*) FILTER (WHERE gender = 'male') as male,
        COUNT(*) FILTER (WHERE gender = 'female') as female
      FROM profiles
    `);
    
    return {
      total: parseInt(result.rows[0].total),
      complete: parseInt(result.rows[0].complete),
      male: parseInt(result.rows[0].male),
      female: parseInt(result.rows[0].female)
    };
  }
  
  /**
   * آمار چت‌ها
   */
  private async getChatStats() {
    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE ended_at >= CURRENT_DATE) as ended_today,
        AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) FILTER (WHERE ended_at IS NOT NULL) as avg_duration
      FROM chats
    `);
    
    const messagesResult = await query('SELECT COUNT(*) as total FROM messages');
    
    return {
      total: parseInt(result.rows[0].total),
      active: parseInt(result.rows[0].active),
      endedToday: parseInt(result.rows[0].ended_today) || 0,
      averageDuration: Math.round(parseFloat(result.rows[0].avg_duration) || 0),
      totalMessages: parseInt(messagesResult.rows[0].total)
    };
  }
  
  /**
   * آمار سکه‌ها
   */
  private async getCoinStats() {
    const result = await query(`
      SELECT
        COALESCE(SUM(balance), 0) as total_circulating
      FROM coins
    `);
    
    const transactionsResult = await query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'earn'), 0) as total_earned,
        COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'spend'), 0) as total_spent,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_transactions
      FROM coin_transactions
    `);
    
    return {
      totalCirculating: parseInt(result.rows[0].total_circulating),
      totalEarned: parseInt(transactionsResult.rows[0].total_earned),
      totalSpent: parseInt(transactionsResult.rows[0].total_spent),
      transactionsToday: parseInt(transactionsResult.rows[0].today_transactions)
    };
  }
  
  /**
   * آمار گزارش‌ها
   */
  private async getReportStats() {
    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status IN ('resolved', 'dismissed')) as resolved,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_reports
      FROM reports
    `);
    
    return {
      total: parseInt(result.rows[0].total),
      pending: parseInt(result.rows[0].pending),
      resolved: parseInt(result.rows[0].resolved),
      todayReports: parseInt(result.rows[0].today_reports)
    };
  }
  
  /**
   * آمار رفرال‌ها
   */
  private async getReferralStats() {
    const countResult = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE referred_by IS NOT NULL) as successful
      FROM users
    `);
    
    const topReferrersResult = await query(`
      SELECT 
        u.id as user_id,
        u.username,
        COUNT(r.id) as referral_count
      FROM users u
      JOIN users r ON r.referred_by = u.id
      GROUP BY u.id, u.username
      ORDER BY referral_count DESC
      LIMIT 10
    `);
    
    return {
      totalReferrals: parseInt(countResult.rows[0].total),
      successfulReferrals: parseInt(countResult.rows[0].successful),
      topReferrers: topReferrersResult.rows.map(row => ({
        userId: row.user_id,
        username: row.username || 'Unknown',
        count: parseInt(row.referral_count)
      }))
    };
  }
  
  /**
   * چارت ثبت‌نام کاربران (30 روز گذشته)
   */
  async getUserRegistrationChart(): Promise<ChartData> {
    const result = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM users
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);
    
    return {
      labels: result.rows.map(row => row.date.toISOString().split('T')[0]),
      data: result.rows.map(row => parseInt(row.count))
    };
  }
  
  /**
   * چارت چت‌های روزانه (30 روز گذشته)
   */
  async getDailyChatChart(): Promise<ChartData> {
    const result = await query(`
      SELECT 
        DATE(started_at) as date,
        COUNT(*) as count
      FROM chats
      WHERE started_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(started_at)
      ORDER BY date
    `);
    
    return {
      labels: result.rows.map(row => row.date.toISOString().split('T')[0]),
      data: result.rows.map(row => parseInt(row.count))
    };
  }
  
  /**
   * چارت پیام‌های روزانه (30 روز گذشته)
   */
  async getDailyMessageChart(): Promise<ChartData> {
    const result = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM messages
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);
    
    return {
      labels: result.rows.map(row => row.date.toISOString().split('T')[0]),
      data: result.rows.map(row => parseInt(row.count))
    };
  }
  
  /**
   * چارت تراکنش‌های سکه (30 روز گذشته)
   */
  async getCoinTransactionChart(): Promise<{ earned: ChartData; spent: ChartData }> {
    const result = await query(`
      SELECT 
        DATE(created_at) as date,
        SUM(amount) FILTER (WHERE transaction_type = 'earn') as earned,
        SUM(amount) FILTER (WHERE transaction_type = 'spend') as spent
      FROM coin_transactions
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);
    
    return {
      earned: {
        labels: result.rows.map(row => row.date.toISOString().split('T')[0]),
        data: result.rows.map(row => parseInt(row.earned) || 0)
      },
      spent: {
        labels: result.rows.map(row => row.date.toISOString().split('T')[0]),
        data: result.rows.map(row => parseInt(row.spent) || 0)
      }
    };
  }
  
  /**
   * چارت توزیع سنی کاربران
   */
  async getAgeDistributionChart(): Promise<ChartData> {
    const result = await query(`
      SELECT 
        CASE 
          WHEN age BETWEEN 13 AND 17 THEN '13-17'
          WHEN age BETWEEN 18 AND 24 THEN '18-24'
          WHEN age BETWEEN 25 AND 34 THEN '25-34'
          WHEN age BETWEEN 35 AND 44 THEN '35-44'
          WHEN age >= 45 THEN '45+'
          ELSE 'نامشخص'
        END as age_group,
        COUNT(*) as count
      FROM profiles
      WHERE age IS NOT NULL
      GROUP BY age_group
      ORDER BY age_group
    `);
    
    return {
      labels: result.rows.map(row => row.age_group),
      data: result.rows.map(row => parseInt(row.count))
    };
  }
  
  /**
   * چارت توزیع جغرافیایی کاربران
   */
  async getGeographicDistributionChart(): Promise<ChartData> {
    const result = await query(`
      SELECT 
        province,
        COUNT(*) as count
      FROM profiles
      WHERE province IS NOT NULL
      GROUP BY province
      ORDER BY count DESC
      LIMIT 15
    `);
    
    return {
      labels: result.rows.map(row => row.province),
      data: result.rows.map(row => parseInt(row.count))
    };
  }
  
  /**
   * چارت نوع گزارش‌ها
   */
  async getReportTypeChart(): Promise<ChartData> {
    const result = await query(`
      SELECT 
        reason,
        COUNT(*) as count
      FROM reports
      GROUP BY reason
      ORDER BY count DESC
    `);
    
    return {
      labels: result.rows.map(row => row.reason),
      data: result.rows.map(row => parseInt(row.count))
    };
  }
  
  /**
   * آمار ساعتی فعالیت (24 ساعت گذشته)
   */
  async getHourlyActivityChart(): Promise<ChartData> {
    const result = await query(`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as count
      FROM messages
      WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      GROUP BY hour
      ORDER BY hour
    `);
    
    const labels: string[] = [];
    const data: number[] = [];
    
    for (let i = 0; i < 24; i++) {
      labels.push(`${i}:00`);
      const found = result.rows.find(row => parseInt(row.hour) === i);
      data.push(found ? parseInt(found.count) : 0);
    }
    
    return { labels, data };
  }
  
  /**
   * آمار نسبت جنسیتی چت‌ها
   */
  async getGenderChatRatioChart(): Promise<ChartData> {
    const result = await query(`
      SELECT 
        chat_type,
        COUNT(*) as count
      FROM chats
      GROUP BY chat_type
    `);
    
    return {
      labels: result.rows.map(row => row.chat_type),
      data: result.rows.map(row => parseInt(row.count))
    };
  }
}

export const statsService = new StatsService();
