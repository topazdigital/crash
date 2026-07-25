#!/bin/bash
# =============================================================================
# CrashBet Hub — One-Time Server Setup
# Run this ONCE on the VPS after cloning the repo.
# Usage: bash scripts/server-setup.sh
# =============================================================================
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_HTML="/domains/aviator.betcheza.co.ke/public_html"

echo "==> [1/5] Installing pnpm..."
npm install -g pnpm pm2

echo "==> [2/5] Installing project dependencies..."
cd "$REPO_DIR"
pnpm install

echo "==> [3/5] Creating .env.production from example (if not already present)..."
if [ ! -f "$REPO_DIR/.env.production" ]; then
  cp "$REPO_DIR/.env.production.example" "$REPO_DIR/.env.production"
  echo ""
  echo "  !! ACTION REQUIRED: Edit .env.production and fill in your real values:"
  echo "     nano $REPO_DIR/.env.production"
  echo ""
fi

echo "==> [4/5] Enabling mod_proxy in Apache (requires root)..."
if command -v a2enmod &>/dev/null; then
  a2enmod proxy proxy_http rewrite headers
  service apache2 restart 2>/dev/null || apachectl restart 2>/dev/null || true
else
  echo "  Skipped (not Ubuntu/Debian Apache). Enable mod_proxy manually if needed."
fi

echo "==> [5/5] Setting up PM2 to survive reboots..."
pm2 startup || true
echo ""
echo "================================================================"
echo " Setup complete. Next steps:"
echo "  1. Edit .env.production:  nano $REPO_DIR/.env.production"
echo "  2. Run the deploy script: bash scripts/server-deploy.sh"
echo "================================================================"
