// src/migrations/001_initial_schema.ts
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

export async function up(pool: Pool): Promise<void> {
  console.log('🚀 Running initial schema migration...');
  
  const schemaPath = path.join(__dirname, '../../schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  
  await pool.query(schemaSql);
  
  console.log('✅ Initial schema migration completed');
}

export async function down(pool: Pool): Promise<void> {
  console.log('⚠️  Rolling back initial schema...');
  
  // Drop all tables in reverse order
  const tables = [
    'system_settings',
    'daily_statistics',
    'admin_actions',
    'admins',
    'reports',
    'anonymous_messages',
    'blocks',
    'contacts',
    'directs',
    'messages',
    'chats',
    'coin_transactions',
    'coins',
    'profiles',
    'users'
  ];
  
  for (const table of tables) {
    await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
  }
  
  // Drop views
  await pool.query('DROP VIEW IF EXISTS user_stats CASCADE');
  await pool.query('DROP VIEW IF EXISTS active_chats_view CASCADE');
  await pool.query('DROP VIEW IF EXISTS pending_reports_view CASCADE');
  
  // Drop functions
  await pool.query('DROP FUNCTION IF EXISTS update_updated_at_column CASCADE');
  await pool.query('DROP FUNCTION IF EXISTS update_profile_stats_on_message CASCADE');
  await pool.query('DROP FUNCTION IF EXISTS update_profile_total_chats CASCADE');
  await pool.query('DROP FUNCTION IF EXISTS get_user_active_chat CASCADE');
  await pool.query('DROP FUNCTION IF EXISTS is_user_in_active_chat CASCADE');
  await pool.query('DROP FUNCTION IF EXISTS get_unread_messages_count CASCADE');
  await pool.query('DROP FUNCTION IF EXISTS get_unread_directs_count CASCADE');
  await pool.query('DROP FUNCTION IF EXISTS can_users_chat CASCADE');
  await pool.query('DROP FUNCTION IF EXISTS generate_unique_custom_id CASCADE');
  await pool.query('DROP FUNCTION IF EXISTS generate_anonymous_link_token CASCADE');
  
  // Drop types
  await pool.query('DROP TYPE IF EXISTS gender_type CASCADE');
  await pool.query('DROP TYPE IF EXISTS chat_status CASCADE');
  await pool.query('DROP TYPE IF EXISTS message_type CASCADE');
  await pool.query('DROP TYPE IF EXISTS coin_transaction_type CASCADE');
  await pool.query('DROP TYPE IF EXISTS report_status CASCADE');
  await pool.query('DROP TYPE IF EXISTS report_reason CASCADE');
  await pool.query('DROP TYPE IF EXISTS direct_status CASCADE');
  await pool.query('DROP TYPE IF EXISTS admin_role CASCADE');
  
  console.log('✅ Schema rollback completed');
}
