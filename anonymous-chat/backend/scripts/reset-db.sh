#!/bin/bash

echo "🔄 Starting database reset..."

# 1. توقف کانتینرها
echo "⏸️  Stopping containers..."
docker-compose -f docker-compose.dev.yml down -v

# 2. حذف volumes (اگر وجود دارد)
echo "🗑️  Removing old volumes..."
sudo docker volume rm anonymous_chat_db_data 2>/dev/null || true
sudo docker volume rm anonymous_chat_redis_data 2>/dev/null || true

# 3. شروع مجدد کانتینرها
echo "🚀 Starting containers..."
sudo docker-compose -f docker-compose.dev.yml up -d

# 4. انتظار برای آماده شدن PostgreSQL
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10

# 5. اجرای Schema
echo "📊 Running schema..."
# docker exec -i anonymous_chat_db_dev psql -U postgres -d anonymous_chat < db/schema.sql
sudo docker exec -i anonymous_chat_db_dev psql -U postgres -d anonymous_chat < src/database/schema.sql


echo "✅ Database reset completed!"
echo ""
echo "📌 Next steps:"
echo "   1. Check database: docker exec -it anonymous_chat_db_dev psql -U postgres -d anonymous_chat"
echo "   2. Start app: npm run dev"
