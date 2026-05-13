#!/bin/bash
set -e

echo "=== Railway Deployment Starting ==="
echo "All environment variables:"
env | grep -E "^(DATABASE_URL|PORT|JWT_SECRET|PGHOST|PGUSER|PGPASSWORD)" || echo "No DB env vars found"

echo ""
echo "Waiting for DATABASE_URL to be available..."
# Wait for DATABASE_URL to be set (Railway injects from PostgreSQL plugin)
COUNTER=0
until [ -n "$DATABASE_URL" ] || [ $COUNTER -gt 30 ]; do
    echo "DATABASE_URL not set, waiting... ($COUNTER/30)"
    sleep 2
    COUNTER=$((COUNTER+1))
done

if [ -z "$DATABASE_URL" ]; then
    echo "WARNING: DATABASE_URL still not set after waiting. Will try to continue anyway..."
    echo "This may fail if the database is not properly configured."
fi

echo "DATABASE_URL is available: ${DATABASE_URL:0:30}..."

echo "Running prisma generate..."
npx prisma generate

echo "Running database migrations..."
npx prisma db push --accept-data-loss --skip-generate

echo "Starting application..."
node dist/index.js
