#!/bin/bash

# Database Setup Script
# Usage: ./scripts/run-migration.sh

echo "🚀 Setting up database from schema.sql..."
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | xargs)
else
    echo "❌ .env file not found!"
    exit 1
fi

# Run schema.sql
echo "📋 Running schema.sql (complete database setup)"
psql "$DATABASE_URL" -f src/database/schema.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database setup completed successfully!"
    echo ""
    echo "📊 Checking tables..."
    psql "$DATABASE_URL" -c "\d random_chat_messages" | grep -E "is_deleted|local_file"
    echo ""
else
    echo ""
    echo "❌ Database setup failed!"
    exit 1
fi

echo "🎉 All done! Your database is now ready with:"
echo "   ✅ Soft delete for messages"
echo "   ✅ Local file storage support"
echo "   ✅ 50MB file size limit"
echo "   ✅ Data protection with RESTRICT"
