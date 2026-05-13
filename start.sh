#!/bin/bash
set -e

echo "Waiting for DATABASE_URL to be available..."
# Wait for DATABASE_URL to be set
until [ -n "$DATABASE_URL" ]; do
    echo "DATABASE_URL not set, waiting..."
    sleep 1
done

echo "DATABASE_URL is available: ${DATABASE_URL:0:20}..."

echo "Running prisma generate..."
npx prisma generate

echo "Running database migrations..."
npx prisma db push --accept-data-loss

echo "Starting application..."
node dist/index.js
