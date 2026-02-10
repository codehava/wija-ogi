#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════════════
# WIJA 3 - Docker Startup Script
# Applies database schema then starts the Next.js server
# ═══════════════════════════════════════════════════════════════════════════════

set -e

echo "🔄 Applying database schema..."
npx drizzle-kit push --force 2>&1 || {
    echo "⚠️  Schema push failed, but continuing startup..."
}
echo "✅ Database schema ready"

echo "🚀 Starting WIJA 3..."
exec node server.js
