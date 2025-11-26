-- ساخت اکستنشن‌های مورد نیاز
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- تنظیمات اولیه
ALTER DATABASE anonymous_chat SET timezone TO 'UTC';

-- اطلاعات اولیه
SELECT 'Database initialized successfully!' AS status;
