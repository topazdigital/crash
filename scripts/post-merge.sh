#!/bin/bash
set -e
pnpm install --frozen-lockfile
if [ -n "${MYSQL_URL:-}" ]; then
  pnpm --filter @workspace/db push
else
  echo "MYSQL_URL is not configured; skipping MySQL schema push."
fi
