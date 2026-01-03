#!/bin/bash

# Script to verify storage system installation
# Usage: ./scripts/verify-storage.sh

echo "🔍 Verifying Storage System Installation..."
echo ""

# Check if schema file exists
if [ ! -f "src/database/schema.sql" ]; then
    echo "❌ Schema file not found!"
    exit 1
fi
echo "✅ Schema file exists"

# Check schema.sql contains new fields
if grep -q "is_deleted_user1" src/database/schema.sql && \
   grep -q "local_file_path" src/database/schema.sql && \
   grep -q "file_size" src/database/schema.sql; then
    echo "✅ Schema contains soft delete and file storage fields"
else
    echo "❌ Schema is missing required fields!"
    exit 1
fi

# Check if storage service exists
if [ ! -f "src/utils/storage.ts" ]; then
    echo "❌ Storage service not found!"
    exit 1
fi
echo "✅ Storage service exists"

# Check if uploads directory exists
mkdir -p public/uploads/{images,videos,voices,documents,stickers}
echo "✅ Upload directories created"

# Check database connection
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | xargs)
    
    echo ""
    echo "📊 Checking database tables..."
    
    # Check random_chat_messages
    psql "$DATABASE_URL" -t -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'random_chat_messages' AND column_name IN ('is_deleted_user1', 'local_file_path', 'file_size');" | wc -l | xargs -I {} echo "   random_chat_messages: {} columns"
    
    # Check messages
    psql "$DATABASE_URL" -t -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'messages' AND column_name IN ('is_deleted_sender', 'local_file_path', 'file_size');" | wc -l | xargs -I {} echo "   messages: {} columns"
    
    # Check directs
    psql "$DATABASE_URL" -t -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'directs' AND column_name IN ('is_deleted_sender', 'local_file_path', 'file_size');" | wc -l | xargs -I {} echo "   directs: {} columns"
fi

echo ""
echo "🎉 Storage system verification complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Setup database: ./scripts/run-migration.sh"
echo "   2. Restart your application"
echo "   3. Test by sending files in chat"
