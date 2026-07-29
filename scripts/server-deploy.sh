#!/bin/bash
# =============================================================================
# CrashBet Hub — Deploy Script
# Run after every git pull to rebuild and restart the app.
# Usage: bash scripts/server-deploy.sh
# =============================================================================
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT=3002
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
  PUBLIC_HTML="$(find /home -type d -path "*/$DOMAIN/public_html" 2>/dev/null | head -1)"
  if [ -z "$PUBLIC_HTML" ]; then
    echo "ERROR: Cannot find public_html for $DOMAIN. Set PUBLIC_HTML manually in this script."
    exit 1
  fi
fi
echo "  Using public_html: $PUBLIC_HTML"

echo "==> [1/7] Pulling latest code from GitHub..."
cd "$REPO_DIR"
git pull origin main

echo "==> [2/7] Installing / updating dependencies..."
pnpm install

echo "==> [3/7] Loading production environment variables..."
if [ ! -f "$REPO_DIR/.env.production" ]; then
  echo "ERROR: .env.production not found. Run scripts/server-setup.sh first."
  exit 1
fi
# Source env for the current shell (used by build steps)
set -a
source "$REPO_DIR/.env.production"
set +a

echo "==> [4/7] Building React frontend..."
# BASE_PATH and PORT are required by vite.config.ts at build time
(export BASE_PATH="/"; export PORT=3000; pnpm --filter @workspace/pantaneax run build)

echo "==> [5/7] Deploying frontend to public_html..."
rm -rf "$PUBLIC_HTML"/*
cp -r "$REPO_DIR/artifacts/pantaneax/dist/public/." "$PUBLIC_HTML/"
cp "$REPO_DIR/scripts/htaccess.template" "$PUBLIC_HTML/.htaccess"
echo "  Frontend deployed to $PUBLIC_HTML"

echo "==> [6/7] Building API server..."
pnpm --filter @workspace/api-server run build

echo "==> [7/7] Starting API server via PM2 with ecosystem config..."
# Generate a PM2 ecosystem file that bakes in ALL env vars from .env.production.
# This ensures PM2 restores the full environment on server reboot or crash restart,
# even if .env.production is not sourced in the shell.
python3 - <<PYEOF
import json, os, re

env_file = "$REPO_DIR/.env.production"
out_file = "$REPO_DIR/ecosystem.config.cjs"

env = {}
with open(env_file) as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r'^([A-Za-z_][A-Za-z0-9_]*)=(.*)$', line)
        if m:
            key, val = m.group(1), m.group(2)
            # Strip surrounding quotes
            if (val.startswith('"') and val.endswith('"')) or \
               (val.startswith("'") and val.endswith("'")):
                val = val[1:-1]
            env[key] = val

# Override/add required vars
env["PORT"] = "$API_PORT"
env["NODE_ENV"] = "production"

config = {
    "apps": [{
        "name": "$APP_NAME",
        "script": "node",
        "args": "--enable-source-maps $REPO_DIR/artifacts/api-server/dist/index.mjs",
        "env": env,
        "watch": False,
        "autorestart": True,
        "max_restarts": 10,
        "restart_delay": 2000
    }]
}

with open(out_file, "w") as f:
    f.write("module.exports = " + json.dumps(config, indent=2) + ";\n")

print(f"  Ecosystem config written to {out_file}")
print(f"  API will listen on port $API_PORT")
PYEOF

# Stop existing instance (if any)
if pm2 describe "$APP_NAME" &>/dev/null; then
  pm2 delete "$APP_NAME"
fi

# Start via ecosystem file — env vars survive restarts and reboots
pm2 start "$REPO_DIR/ecosystem.config.cjs"
pm2 save

# Give it 3 seconds to start, then verify it's listening
sleep 3
if ss -tlnp | grep -q ":$API_PORT "; then
  echo "  ✓ API is listening on port $API_PORT"
else
  echo "  WARNING: API does not appear to be listening on port $API_PORT"
  echo "           Check logs: pm2 logs $APP_NAME --lines 30"
fi

echo ""
echo "================================================================"
echo " Deploy complete!"
echo "  Frontend: https://$DOMAIN"
echo "  API:      http://localhost:$API_PORT/api"
echo "  PM2 logs: pm2 logs $APP_NAME"
echo ""
echo " If this is the first deploy or Apache hasn't been fixed yet:"
echo "  bash $REPO_DIR/scripts/vps-fix-apache.sh $API_PORT"
echo "================================================================"
