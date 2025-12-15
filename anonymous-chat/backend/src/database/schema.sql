-- ==================== DATABASE SCHEMA ====================
-- PostgreSQL 14+
-- Encoding: UTF8
-- Timezone: Asia/Tehran

-- ==================== EXTENSIONS ====================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ==================== ENUMS ====================

CREATE TYPE gender_type AS ENUM ('male', 'female');
CREATE TYPE chat_status AS ENUM ('active', 'ended', 'reported');
CREATE TYPE message_type AS ENUM ('text', 'photo', 'video', 'voice', 'sticker');
CREATE TYPE coin_transaction_type AS ENUM (
    'earn',
    'spend',
    'purchase',
    'referral',
    'referral_bonus',
    'reward',
    'fine',
    'initial_bonus',
    'referral_reward',
    'chat_reward',
    'gender_chat_cost',
    'direct_cost',
    'unblock_fine',
    'admin_adjustment'
);
CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'resolved', 'rejected');
CREATE TYPE report_reason AS ENUM (
    'inappropriate_content',
    'harassment',
    'spam',
    'fake_profile',
    'underage',
    'other'
);
CREATE TYPE direct_status AS ENUM ('sent', 'read', 'blocked');
CREATE TYPE admin_role AS ENUM ('super_admin', 'admin', 'moderator');

-- ==================== TABLES (CORRECT ORDER) ====================


-- -------------------- USERS (No FK) --------------------

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    language_code VARCHAR(10) DEFAULT 'fa',
    
    referred_by INTEGER,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    referral_count INTEGER DEFAULT 0,
    successful_referrals INTEGER DEFAULT 0,
    
    is_blocked BOOLEAN DEFAULT FALSE,      -- تغییر از is_banned
    block_reason TEXT,                     -- تغییر از ban_reason
    blocked_at TIMESTAMP,                  -- تغییر از banned_at
    unblock_fine INTEGER DEFAULT 50,      -- اضافه شده

    is_silent BOOLEAN DEFAULT FALSE,              -- ✅ اضافه شد
    silent_until TIMESTAMP,  
    
    last_ended_chat_id INTEGER,                   -- ✅ آخرین چت پایان‌یافته برای دستور /delete
    
    is_online BOOLEAN DEFAULT FALSE,
    last_activity TIMESTAMP DEFAULT NOW(),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT users_telegram_id_check CHECK (telegram_id > 0)
);

-- Add FK to users.referred_by AFTER table creation
ALTER TABLE users ADD CONSTRAINT fk_users_referred_by 
    FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL;


-- -------------------- PROFILES --------------------

CREATE TABLE profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    custom_id VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    gender gender_type NOT NULL,
    age INTEGER NOT NULL,
    bio TEXT,
    
    province INTEGER NOT NULL,           -- ✅ تغییر به INTEGER
    city INTEGER NOT NULL,               -- ✅ تغییر به INTEGER
    
    latitude DECIMAL(10, 8),             -- ✅ موقعیت جغرافیایی (عرض جغرافیایی)
    longitude DECIMAL(11, 8),            -- ✅ موقعیت جغرافیایی (طول جغرافیایی)
    
    photo_file_id TEXT,                  -- ✅ اضافه شد
    likes_count INTEGER DEFAULT 0,       -- ✅ اضافه شد

    show_likes BOOLEAN DEFAULT TRUE,               -- ✅ اضافه شد
    alert_profile_view BOOLEAN DEFAULT FALSE,       -- ✅ اضافه شد
    alert_profile_like BOOLEAN DEFAULT FALSE,
    
    anonymous_link_token VARCHAR(100) UNIQUE NOT NULL,
    anonymous_link_enabled BOOLEAN DEFAULT TRUE,
    
    total_chats INTEGER DEFAULT 0,
    total_messages_sent INTEGER DEFAULT 0,
    total_messages_received INTEGER DEFAULT 0,
    rating DECIMAL(3, 2) DEFAULT 5.00,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT profiles_age_check CHECK (age >= 13 AND age <= 100),
    CONSTRAINT profiles_rating_check CHECK (rating >= 0 AND rating <= 5)
);

-- -------------------- COINS --------------------

CREATE TABLE coins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance INTEGER DEFAULT 0 NOT NULL,
    total_earned INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    total_purchased INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT coins_balance_check CHECK (balance >= 0)
);

-- -------------------- ADMINS (Before reports) --------------------

CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    full_name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    role admin_role DEFAULT 'moderator',
    
    can_ban_users BOOLEAN DEFAULT FALSE,
    can_adjust_coins BOOLEAN DEFAULT FALSE,
    can_view_reports BOOLEAN DEFAULT TRUE,
    can_manage_admins BOOLEAN DEFAULT FALSE,
    
    is_active BOOLEAN DEFAULT TRUE,
    
    last_login TIMESTAMP,
    login_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- -------------------- CHATS (Before messages/directs) --------------------

CREATE TABLE chats (
    id SERIAL PRIMARY KEY,
    
    user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    is_gender_specific BOOLEAN DEFAULT FALSE,
    target_gender gender_type,
    
    cost_user1 INTEGER DEFAULT 0,
    cost_user2 INTEGER DEFAULT 0,
    
    status chat_status DEFAULT 'active',
    ended_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    message_count INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    
    reward_given BOOLEAN DEFAULT FALSE,
    
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT chats_users_different CHECK (user1_id != user2_id),
    CONSTRAINT chats_costs_check CHECK (cost_user1 >= 0 AND cost_user2 >= 0)
);

-- -------------------- MESSAGES --------------------

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    type message_type DEFAULT 'text',
    content TEXT,
    file_id VARCHAR(255),
    
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT messages_content_check CHECK (
        (type = 'text' AND content IS NOT NULL) OR
        (type != 'text' AND file_id IS NOT NULL)
    )
);

-- -------------------- DIRECTS --------------------

CREATE TABLE directs (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    type message_type DEFAULT 'text',
    content TEXT,
    file_id VARCHAR(255),
    
    status direct_status DEFAULT 'sent',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    
    reply_to_direct_id INTEGER REFERENCES directs(id) ON DELETE SET NULL,
    has_reply BOOLEAN DEFAULT FALSE,
    
    cost INTEGER DEFAULT 1,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT directs_users_different CHECK (sender_id != receiver_id),
    CONSTRAINT directs_content_check CHECK (
        (type = 'text' AND content IS NOT NULL) OR
        (type != 'text' AND file_id IS NOT NULL)
    )
);

-- -------------------- RANDOM CHATS --------------------

-- جدول صف انتظار برای جستجوی چت تصادفی
CREATE TABLE random_chat_queue (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    search_type VARCHAR(20) NOT NULL CHECK (search_type IN ('any', 'male', 'female')),
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_user_in_queue UNIQUE (user_id)
);

CREATE TABLE random_chats (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    safe_mode_user1 BOOLEAN DEFAULT FALSE,
    safe_mode_user2 BOOLEAN DEFAULT FALSE,
    
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    ended_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT random_chats_users_different CHECK (user1_id != user2_id)
);

-- Add FK to users.last_ended_chat_id AFTER random_chats creation
ALTER TABLE users ADD CONSTRAINT fk_users_last_ended_chat_id 
    FOREIGN KEY (last_ended_chat_id) REFERENCES random_chats(id) ON DELETE SET NULL;

-- -------------------- RANDOM CHAT MESSAGES --------------------

CREATE TABLE random_chat_messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES random_chats(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('text', 'photo', 'video', 'voice', 'document', 'sticker')),
    message_text TEXT,
    file_id VARCHAR(255),
    
    telegram_message_id_user1 INTEGER,
    telegram_message_id_user2 INTEGER,
    
    -- ✅ پشتیبانی از reply
    reply_to_message_id INTEGER REFERENCES random_chat_messages(id) ON DELETE SET NULL,
    
    -- ✅ پشتیبانی از ویرایش
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- -------------------- COIN TRANSACTIONS (After chats/directs) --------------------

CREATE TABLE coin_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type coin_transaction_type NOT NULL,
    description TEXT,
    reference_id INTEGER,
    
    related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    related_chat_id INTEGER REFERENCES chats(id) ON DELETE SET NULL,
    related_direct_id INTEGER REFERENCES directs(id) ON DELETE SET NULL,
    
    balance_before INTEGER DEFAULT 0,
    balance_after INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT coin_transactions_amount_check CHECK (amount != 0)
);

-- -------------------- CONTACTS --------------------

CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    nickname VARCHAR(100),
    notes TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    
    added_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT contacts_users_different CHECK (user_id != contact_user_id),
    CONSTRAINT contacts_unique_pair UNIQUE (user_id, contact_user_id)
);

-- -------------------- BLOCKS --------------------

CREATE TABLE blocks (
    id SERIAL PRIMARY KEY,
    blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    reason TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT blocks_users_different CHECK (blocker_id != blocked_id),
    CONSTRAINT blocks_unique_pair UNIQUE (blocker_id, blocked_id)
);

-- -------------------- CHAT REQUESTS --------------------

CREATE TABLE chat_requests (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'accepted', 'rejected', 'blocked', 'expired')),
    
    -- پیام نوتیف در تلگرام گیرنده
    notification_message_id BIGINT,
    
    -- زمان‌ها
    created_at TIMESTAMP DEFAULT NOW(),
    viewed_at TIMESTAMP,
    responded_at TIMESTAMP,
    
    -- آیا متصل شدند؟
    connected BOOLEAN DEFAULT FALSE,
    
    CONSTRAINT chat_requests_users_different CHECK (sender_id != receiver_id)
);


-- -------------------- LIKES (Profile Likes) --------------------

-- CREATE TABLE likes (
--     id SERIAL PRIMARY KEY,
--     liker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     liked_profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
--     created_at TIMESTAMP DEFAULT NOW(),
    
--     CONSTRAINT likes_users_different CHECK (
--         liker_id != (SELECT user_id FROM profiles WHERE id = liked_profile_id)
--     ),
--     CONSTRAINT likes_unique_pair UNIQUE (liker_id, liked_profile_id)
-- );

CREATE TABLE likes (
    id SERIAL PRIMARY KEY,
    liker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    liked_profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT likes_unique_pair UNIQUE (liker_id, liked_profile_id)
);


-- -------------------- DIRECT MESSAGES --------------------

CREATE TABLE direct_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT different_users CHECK (sender_id != receiver_id)
);


-- -------------------- ANONYMOUS MESSAGES --------------------

CREATE TABLE anonymous_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    link_token VARCHAR(100) NOT NULL,
    
    type message_type DEFAULT 'text',
    content TEXT,
    file_id VARCHAR(255),
    
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    is_sender_blocked BOOLEAN DEFAULT FALSE,
    
    reply_to_message_id INTEGER REFERENCES anonymous_messages(id) ON DELETE SET NULL,
    has_reply BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT anonymous_messages_content_check CHECK (
        (type = 'text' AND content IS NOT NULL) OR
        (type != 'text' AND file_id IS NOT NULL)
    )
);

-- -------------------- REPORTS (After admins) --------------------

CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    reason report_reason NOT NULL,
    description TEXT,
    
    chat_id INTEGER REFERENCES chats(id) ON DELETE SET NULL,
    message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
    direct_id INTEGER REFERENCES directs(id) ON DELETE SET NULL,
    
    status report_status DEFAULT 'pending',
    reviewed_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    review_notes TEXT,
    reviewed_at TIMESTAMP,
    
    action_taken TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT reports_users_different CHECK (reporter_id != reported_id)
);

-- -------------------- ADMIN ACTIONS (After reports) --------------------

CREATE TABLE admin_actions (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    
    action_type VARCHAR(50) NOT NULL,
    target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    description TEXT,
    
    related_report_id INTEGER REFERENCES reports(id) ON DELETE SET NULL,
    
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- -------------------- STATISTICS --------------------

CREATE TABLE daily_statistics (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    
    new_users_count INTEGER DEFAULT 0,
    active_users_count INTEGER DEFAULT 0,
    online_users_peak INTEGER DEFAULT 0,
    
    total_chats_started INTEGER DEFAULT 0,
    total_chats_ended INTEGER DEFAULT 0,
    random_chats_count INTEGER DEFAULT 0,
    gender_chats_count INTEGER DEFAULT 0,
    avg_chat_duration_seconds INTEGER DEFAULT 0,
    
    total_messages_sent INTEGER DEFAULT 0,
    total_directs_sent INTEGER DEFAULT 0,
    total_anonymous_messages INTEGER DEFAULT 0,
    
    total_coins_earned INTEGER DEFAULT 0,
    total_coins_spent INTEGER DEFAULT 0,
    total_referral_rewards INTEGER DEFAULT 0,
    total_chat_rewards INTEGER DEFAULT 0,
    
    new_reports_count INTEGER DEFAULT 0,
    resolved_reports_count INTEGER DEFAULT 0,
    
    top_provinces JSONB,
    top_cities JSONB,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- -------------------- SETTINGS --------------------

CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    
    updated_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- -------------------- SEARCH RESULTS --------------------

CREATE TABLE search_results (
    id SERIAL PRIMARY KEY,
    search_code VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    search_type VARCHAR(50) NOT NULL,
    gender VARCHAR(10),
    user_ids INTEGER[] NOT NULL,
    total_count INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour')
);

-- ==================== INDEXES ====================
-- (کپی دقیق همون‌ها - بدون تغییر)

CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_users_is_blocked ON users(is_blocked);  -- ✅ تغییر
CREATE INDEX idx_users_is_online ON users(is_online);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_ended_chat_id ON users(last_ended_chat_id);  -- ✅ برای دستور /delete

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_custom_id ON profiles(custom_id);
CREATE INDEX idx_profiles_anonymous_link_token ON profiles(anonymous_link_token);
CREATE INDEX idx_profiles_gender ON profiles(gender);
CREATE INDEX idx_profiles_age ON profiles(age);
CREATE INDEX idx_profiles_province ON profiles(province);
CREATE INDEX idx_profiles_city ON profiles(city);
CREATE INDEX idx_profiles_location ON profiles(province, city);
CREATE INDEX idx_profiles_search ON profiles(gender, age, province, city);
CREATE INDEX idx_profiles_bio_trgm ON profiles USING gin(bio gin_trgm_ops);
CREATE INDEX idx_profiles_photo_file_id ON profiles(photo_file_id);        -- ✅ اضافه شد
CREATE INDEX idx_profiles_likes_count ON profiles(likes_count DESC); 

CREATE INDEX idx_coins_user_id ON coins(user_id);
CREATE INDEX idx_coins_balance ON coins(balance);

CREATE INDEX idx_coin_transactions_user_id ON coin_transactions(user_id);
CREATE INDEX idx_coin_transactions_type ON coin_transactions(type);
CREATE INDEX idx_coin_transactions_created_at ON coin_transactions(created_at);
CREATE INDEX idx_coin_transactions_user_type ON coin_transactions(user_id, type);

CREATE INDEX idx_chats_user1_id ON chats(user1_id);
CREATE INDEX idx_chats_user2_id ON chats(user2_id);
CREATE INDEX idx_chats_status ON chats(status);
CREATE INDEX idx_chats_started_at ON chats(started_at);
CREATE INDEX idx_chats_users ON chats(user1_id, user2_id);
CREATE INDEX idx_chats_active_user ON chats(user1_id, status) WHERE status = 'active';

CREATE INDEX idx_random_chat_queue_user_id ON random_chat_queue(user_id);
CREATE INDEX idx_random_chat_queue_search_type ON random_chat_queue(search_type);
CREATE INDEX idx_random_chat_queue_created_at ON random_chat_queue(created_at);

CREATE INDEX idx_random_chats_user1_id ON random_chats(user1_id);
CREATE INDEX idx_random_chats_user2_id ON random_chats(user2_id);
CREATE INDEX idx_random_chats_status ON random_chats(status);
CREATE INDEX idx_random_chats_active_user1 ON random_chats(user1_id, status) WHERE status = 'active';
CREATE INDEX idx_random_chats_active_user2 ON random_chats(user2_id, status) WHERE status = 'active';

CREATE INDEX idx_random_chat_messages_chat_id ON random_chat_messages(chat_id);
CREATE INDEX idx_random_chat_messages_sender_id ON random_chat_messages(sender_id);
CREATE INDEX idx_random_chat_messages_created_at ON random_chat_messages(created_at);

CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_is_read ON messages(is_read);
CREATE INDEX idx_messages_chat_created ON messages(chat_id, created_at);

CREATE INDEX idx_directs_sender_id ON directs(sender_id);
CREATE INDEX idx_directs_receiver_id ON directs(receiver_id);
CREATE INDEX idx_directs_status ON directs(status);
CREATE INDEX idx_directs_is_read ON directs(is_read);
CREATE INDEX idx_directs_created_at ON directs(created_at);
CREATE INDEX idx_directs_receiver_status ON directs(receiver_id, status);

CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_contact_user_id ON contacts(contact_user_id);
CREATE INDEX idx_contacts_is_favorite ON contacts(is_favorite);

CREATE INDEX idx_blocks_blocker_id ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked_id ON blocks(blocked_id);

CREATE INDEX idx_chat_requests_sender_id ON chat_requests(sender_id);
CREATE INDEX idx_chat_requests_receiver_id ON chat_requests(receiver_id);
CREATE INDEX idx_chat_requests_status ON chat_requests(status);
CREATE INDEX idx_chat_requests_created_at ON chat_requests(created_at);
CREATE INDEX idx_chat_requests_sender_receiver ON chat_requests(sender_id, receiver_id);
CREATE INDEX idx_chat_requests_receiver_status ON chat_requests(receiver_id, status);

CREATE INDEX idx_direct_messages_receiver ON direct_messages(receiver_id, is_read);
CREATE INDEX idx_direct_messages_sender ON direct_messages(sender_id);
CREATE INDEX idx_direct_messages_created ON direct_messages(created_at DESC);

CREATE INDEX idx_likes_liker_id ON likes(liker_id);
CREATE INDEX idx_likes_liked_profile_id ON likes(liked_profile_id);
CREATE INDEX idx_likes_created_at ON likes(created_at);

CREATE INDEX idx_anonymous_messages_sender_id ON anonymous_messages(sender_id);
CREATE INDEX idx_anonymous_messages_receiver_id ON anonymous_messages(receiver_id);
CREATE INDEX idx_anonymous_messages_link_token ON anonymous_messages(link_token);
CREATE INDEX idx_anonymous_messages_created_at ON anonymous_messages(created_at);

CREATE INDEX idx_search_results_code ON search_results(search_code);
CREATE INDEX idx_search_results_user ON search_results(user_id);
CREATE INDEX idx_search_results_expires ON search_results(expires_at);

CREATE INDEX idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX idx_reports_reported_id ON reports(reported_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at);
CREATE INDEX idx_reports_reviewed_by ON reports(reviewed_by);

CREATE INDEX idx_admins_username ON admins(username);
CREATE INDEX idx_admins_email ON admins(email);
CREATE INDEX idx_admins_is_active ON admins(is_active);

CREATE INDEX idx_admin_actions_admin_id ON admin_actions(admin_id);
CREATE INDEX idx_admin_actions_target_user_id ON admin_actions(target_user_id);
CREATE INDEX idx_admin_actions_created_at ON admin_actions(created_at);

CREATE INDEX idx_daily_statistics_date ON daily_statistics(date);

-- ==================== TRIGGERS ====================
-- (کپی دقیق همون triggers)

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coins_updated_at BEFORE UPDATE ON coins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION update_profile_stats_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles
    SET total_messages_sent = total_messages_sent + 1
    WHERE user_id = NEW.sender_id;
    
    UPDATE profiles
    SET total_messages_received = total_messages_received + 1
    WHERE user_id = NEW.receiver_id;
    
    UPDATE chats
    SET message_count = message_count + 1
    WHERE id = NEW.chat_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_profile_stats_on_message
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_profile_stats_on_message();

CREATE OR REPLACE FUNCTION update_profile_total_chats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'ended' AND OLD.status = 'active' THEN
        UPDATE profiles
        SET total_chats = total_chats + 1
        WHERE user_id IN (NEW.user1_id, NEW.user2_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_profile_total_chats
    AFTER UPDATE ON chats
    FOR EACH ROW EXECUTE FUNCTION update_profile_total_chats();


-- ✅ Trigger برای آپدیت likes_count
CREATE OR REPLACE FUNCTION update_profile_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE profiles
        SET likes_count = likes_count + 1
        WHERE id = NEW.liked_profile_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE profiles
        SET likes_count = GREATEST(likes_count - 1, 0)
        WHERE id = OLD.liked_profile_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_profile_likes_count
    AFTER INSERT OR DELETE ON likes
    FOR EACH ROW EXECUTE FUNCTION update_profile_likes_count();


-- ==================== FUNCTIONS ====================
-- (کپی دقیق همون functions)

CREATE OR REPLACE FUNCTION get_user_active_chat(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_chat_id INTEGER;
BEGIN
    SELECT id INTO v_chat_id
    FROM chats
    WHERE (user1_id = p_user_id OR user2_id = p_user_id)
        AND status = 'active'
    ORDER BY started_at DESC
    LIMIT 1;
    
    RETURN v_chat_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_user_in_active_chat(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM chats
        WHERE (user1_id = p_user_id OR user2_id = p_user_id)
            AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_unread_messages_count(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM messages
    WHERE receiver_id = p_user_id
        AND is_read = FALSE;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_unread_directs_count(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM directs
    WHERE receiver_id = p_user_id
        AND is_read = FALSE
        AND status = 'sent';
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION can_users_chat(p_user1_id INTEGER, p_user2_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1
        FROM blocks
        WHERE (blocker_id = p_user1_id AND blocked_id = p_user2_id)
           OR (blocker_id = p_user2_id AND blocked_id = p_user1_id)
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_unique_custom_id()
RETURNS VARCHAR(50) AS $$
DECLARE
    v_custom_id VARCHAR(50);
    v_exists BOOLEAN;
BEGIN
    LOOP
        v_custom_id := 'USER' || LPAD(floor(random() * 1000000)::TEXT, 6, '0');
        
        SELECT EXISTS(SELECT 1 FROM profiles WHERE custom_id = v_custom_id) INTO v_exists;
        
        EXIT WHEN NOT v_exists;
    END LOOP;
    
    RETURN v_custom_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_anonymous_link_token()
RETURNS VARCHAR(100) AS $$
DECLARE
    v_token VARCHAR(100);
    v_exists BOOLEAN;
BEGIN
    LOOP
        v_token := encode(gen_random_bytes(32), 'hex');
        
        SELECT EXISTS(SELECT 1 FROM profiles WHERE anonymous_link_token = v_token) INTO v_exists;
        
        EXIT WHEN NOT v_exists;
    END LOOP;
    
    RETURN v_token;
END;
$$ LANGUAGE plpgsql;

-- ==================== INITIAL DATA ====================

INSERT INTO system_settings (key, value, description) VALUES
    ('maintenance_mode', 'false', 'فعال/غیرفعال بودن حالت تعمیر و نگهداری'),
    ('min_age', '13', 'حداقل سن برای ثبت نام'),
    ('max_age', '100', 'حداکثر سن برای ثبت نام'),
    ('initial_coins', '5', 'تعداد سکه اولیه برای کاربران جدید'),
    ('referral_reward', '10', 'پاداش رفرال'),
    ('chat_reward_threshold', '30', 'تعداد پیام برای پاداش چت'),
    ('chat_reward_amount', '1', 'مقدار پاداش چت'),
    ('random_chat_cost', '0', 'هزینه چت رندم'),
    ('gender_male_chat_cost', '1', 'هزینه چت با پسر'),
    ('gender_female_chat_cost', '2', 'هزینه چت با دختر'),
    ('direct_message_cost', '1', 'هزینه ارسال دایرکت'),
    ('unblock_fine', '50', 'جریمه رفع مسدودیت'),
    ('max_chat_duration', '3600', 'حداکثر مدت زمان چت (ثانیه)'),
    ('max_queue_wait_time', '300', 'حداکثر زمان انتظار در صف (ثانیه)'),
    ('bot_token', '', 'توکن ربات تلگرام'),
    ('admin_telegram_id', '', 'شناسه تلگرام ادمین اصلی')
ON CONFLICT (key) DO NOTHING;

INSERT INTO admins (
    username,
    password_hash,
    full_name,
    email,
    role,
    can_ban_users,
    can_adjust_coins,
    can_view_reports,
    can_manage_admins,
    is_active
) VALUES (
    'admin',
    '$2b$10$YQjT5h8gN8O6K1qW8Ct0VeZpZ7EQYn5nX7qN5wZ5wZ5wZ5wZ5wZ5w',
    'مدیر کل',
    'admin@example.com',
    'super_admin',
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE
) ON CONFLICT (username) DO NOTHING;


-- ==================== ADDITIONAL FUNCTIONS ====================

-- Function برای محاسبه وضعیت آنلاین
CREATE OR REPLACE FUNCTION get_user_online_status(p_user_id INTEGER)
RETURNS TEXT AS $$
DECLARE
    v_last_activity TIMESTAMP;
    v_is_online BOOLEAN;
    v_diff_minutes INTEGER;
BEGIN
    SELECT last_activity, is_online INTO v_last_activity, v_is_online
    FROM users
    WHERE id = p_user_id;
    
    IF v_is_online THEN
        RETURN 'آنلاین';
    END IF;
    
    v_diff_minutes := EXTRACT(EPOCH FROM (NOW() - v_last_activity)) / 60;
    
    IF v_diff_minutes < 5 THEN
        RETURN 'لحظاتی پیش';
    ELSIF v_diff_minutes < 60 THEN
        RETURN v_diff_minutes || ' دقیقه پیش';
    ELSIF v_diff_minutes < 1440 THEN
        RETURN (v_diff_minutes / 60)::INTEGER || ' ساعت پیش';
    ELSE
        RETURN (v_diff_minutes / 1440)::INTEGER || ' روز پیش';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function برای offline کردن کاربران غیرفعال
CREATE OR REPLACE FUNCTION mark_inactive_users_offline()
RETURNS INTEGER AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE users
    SET is_online = FALSE
    WHERE is_online = TRUE
      AND last_activity < NOW() - INTERVAL '5 minutes';
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger برای به‌روزرسانی خودکار last_activity
CREATE OR REPLACE FUNCTION update_user_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity = NOW();
    NEW.is_online = TRUE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_activity
    BEFORE UPDATE ON users
    FOR EACH ROW
    WHEN (OLD.last_activity IS DISTINCT FROM NEW.last_activity)
    EXECUTE FUNCTION update_user_activity();


-- ==================== ADDITIONAL INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_users_online_activity ON users(is_online, last_activity DESC);



-- ==================== VIEWS ====================

CREATE OR REPLACE VIEW user_stats AS
SELECT
    u.id,
    u.telegram_id,
    u.username,
    u.first_name,
    p.custom_id,
    p.gender,
    p.age,
    p.province,
    p.city,
    c.balance AS coin_balance,
    p.total_chats,
    p.total_messages_sent,
    p.total_messages_received,
    p.rating,
    u.referral_count,
    u.is_blocked,
    u.is_online,
    u.last_activity,
    CASE 
        WHEN u.is_online THEN 'آنلاین'
        WHEN (NOW() - u.last_activity) < INTERVAL '5 minutes' THEN 'لحظاتی پیش'
        WHEN (NOW() - u.last_activity) < INTERVAL '1 hour' THEN 
            EXTRACT(EPOCH FROM (NOW() - u.last_activity))::INTEGER / 60 || ' دقیقه پیش'
        WHEN (NOW() - u.last_activity) < INTERVAL '1 day' THEN 
            EXTRACT(EPOCH FROM (NOW() - u.last_activity))::INTEGER / 3600 || ' ساعت پیش'
        ELSE 
            EXTRACT(EPOCH FROM (NOW() - u.last_activity))::INTEGER / 86400 || ' روز پیش'
    END AS online_status_text,
    u.created_at
FROM users u
LEFT JOIN profiles p ON u.id = p.user_id
LEFT JOIN coins c ON u.id = c.user_id;


CREATE OR REPLACE VIEW active_chats_view AS
SELECT
    c.id AS chat_id,
    c.user1_id,
    p1.custom_id AS user1_custom_id,
    p1.display_name AS user1_name,
    p1.gender AS user1_gender,
    c.user2_id,
    p2.custom_id AS user2_custom_id,
    p2.display_name AS user2_name,
    p2.gender AS user2_gender,
    c.is_gender_specific,
    c.message_count,
    c.started_at,
    EXTRACT(EPOCH FROM (NOW() - c.started_at))::INTEGER AS duration_seconds
FROM chats c
JOIN profiles p1 ON c.user1_id = p1.user_id
JOIN profiles p2 ON c.user2_id = p2.user_id
WHERE c.status = 'active';

CREATE OR REPLACE VIEW pending_reports_view AS
SELECT
    r.id AS report_id,
    r.reporter_id,
    p1.custom_id AS reporter_custom_id,
    r.reported_id,
    p2.custom_id AS reported_custom_id,
    p2.display_name AS reported_name,
    r.reason,
    r.description,
    r.chat_id,
    r.created_at,
    EXTRACT(EPOCH FROM (NOW() - r.created_at))::INTEGER AS pending_duration_seconds
FROM reports r
JOIN profiles p1 ON r.reporter_id = p1.user_id
JOIN profiles p2 ON r.reported_id = p2.user_id
WHERE r.status = 'pending'
ORDER BY r.created_at ASC;


-- ✅ View برای پروفایل‌های پرطرفدار
CREATE OR REPLACE VIEW top_liked_profiles AS
SELECT
    p.id AS profile_id,
    p.custom_id,
    p.display_name,
    p.gender,
    p.age,
    p.province,
    p.city,
    p.likes_count,
    p.total_chats,
    p.rating,
    p.photo_file_id,
    u.is_online,
    u.last_activity
FROM profiles p
JOIN users u ON p.user_id = u.id
WHERE p.likes_count > 0
ORDER BY p.likes_count DESC, p.rating DESC
LIMIT 100;

-- ==================== CLEANUP FUNCTIONS ====================

-- حذف خودکار نتایج جستجوی منقضی شده
CREATE OR REPLACE FUNCTION delete_expired_search_results()
RETURNS void AS $$
BEGIN
  DELETE FROM search_results WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ==================== END ====================
