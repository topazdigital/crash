#!/bin/bash
# =============================================================================
# CrashBet Hub — Deploy Script
# Run after every git pull to rebuild and restart the app.
# Usage: bash scripts/server-deploy.sh
# =============================================================================
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT=3001
APP_NAME="crashbet-api"

# Auto-detect public_html path (DirectAdmin stores domains under /home/<user>/domains/)
DOMAIN="aviator.betcheza.co.ke"
if [ -d "/home/admin/domains/$DOMAIN/public_html" ]; then
  PUBLIC_HTML="/home/admin/domains/$DOMAIN/public_html"
elif [ -d "/home/betcheza/domains/$DOMAIN/public_html" ]; then
  PUBLIC_HTML="/home/betcheza/domains/$DOMAIN/public_html"
elif [ -d "/var/www/$DOMAIN/public_html" ]; then
  PUBLIC_HTML="/var/www/$DOMAIN/public_html"
else
  # Fallback: find it
  PUBLIC_HTML="$(find /home -type d -path "*/$DOMAIN/public_html" 2>/dev/null | head -1)"
  if [ -z "$PUBLIC_HTML" ]; then
    echo "ERROR: Cannot find public_html for $DOMAIN. Set PUBLIC_HTML manually in this script."
    exit 1
  fi
fi
echo "  Using public_html: $PUBLIC_HTML"

echo "==> [1/6] Pulling latest code from GitHub..."
cd "$REPO_DIR"
git pull origin main

echo "==> [2/6] Installing / updating dependencies..."
pnpm install

echo "==> [3/6] Loading production environment variables..."
if [ ! -f "$REPO_DIR/.env.production" ]; then
  echo "ERROR: .env.production not found. Run scripts/server-setup.sh first."
  exit 1
fi
set -a
source "$REPO_DIR/.env.production"
set +a

echo "==> [4/6] Building React frontend..."
# BASE_PATH and PORT are required by vite.config.ts at build time
export BASE_PATH="/"
export PORT=3000
pnpm --filter @workspace/pantaneax run build

echo "==> [5/6] Deploying frontend to public_html..."
rm -rf "$PUBLIC_HTML"/*
cp -r "$REPO_DIR/artifacts/pantaneax/dist/public/." "$PUBLIC_HTML/"
cp "$REPO_DIR/scripts/htaccess.template" "$PUBLIC_HTML/.htaccess"
echo "  Frontend deployed to $PUBLIC_HTML"

echo "==> [6/6] Building & restarting API server..."
pnpm --filter @workspace/api-server run build

# Start or restart with PM2
if pm2 describe "$APP_NAME" &>/dev/null; then
  pm2 restart "$APP_NAME" --update-env
else
  PORT=$API_PORT NODE_ENV=production pm2 start \
    "node --enable-source-maps $REPO_DIR/artifacts/api-server/dist/index.mjs" \
    --name "$APP_NAME" \
    --env production
fi
pm2 save

echo ""
echo "================================================================"
echo " Deploy complete!"
echo "  Frontend: https://aviator.betcheza.co.ke"
echo "  API:      http://localhost:$API_PORT/api"
echo "  PM2 logs: pm2 logs $APP_NAME"
echo "================================================================"
