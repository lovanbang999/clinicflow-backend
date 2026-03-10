#!/bin/sh
set -e

echo "🚀 Starting SmartClinic Backend..."

# Run Prisma migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy

echo "✅ Migrations complete. Starting application..."
exec node dist/src/main
