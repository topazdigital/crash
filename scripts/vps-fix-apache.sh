#!/bin/bash
# =============================================================================
# CrashBet Hub — Fix Apache VirtualHost for aviator.betcheza.co.ke
#
# This script removes the DirectAdmin catch-all ProxyPass that blocks the SPA
# and replaces it with an API-only proxy to port 3001 (the Node.js API server).
#
# Usage: bash scripts/vps-fix-apache.sh
# Run as root on the VPS.
# =============================================================================
set -e

DOMAIN="aviator.betcheza.co.ke"
API_PORT=3001

# DirectAdmin stores per-user Apache configs here:
DA_CONF="/usr/local/directadmin/data/users/admin/httpd.conf"

if [ ! -f "$DA_CONF" ]; then
  echo "ERROR: Cannot find DirectAdmin httpd.conf at $DA_CONF"
  echo "       Check that you are root and DirectAdmin is installed."
  exit 1
fi

echo "==> Backing up Apache config..."
cp "$DA_CONF" "${DA_CONF}.bak.$(date +%Y%m%d%H%M%S)"
echo "    Backup saved."

echo "==> Checking current ProxyPass lines for $DOMAIN vhost..."
# Show the vhost block for verification
grep -n "aviator.betcheza" "$DA_CONF" || true

echo ""
echo "==> Removing catch-all ProxyPass / http://127.0.0.1:5001/ ..."
# Remove the DirectAdmin catch-all proxy lines (they block static file serving)
# Use Python for reliable multi-line vhost block editing
python3 - <<'PYEOF'
import re, sys

da_conf = "/usr/local/directadmin/data/users/admin/httpd.conf"
domain  = "aviator.betcheza.co.ke"
api_port = 3001

with open(da_conf, "r") as f:
    content = f.read()

# Find the VirtualHost blocks for aviator.betcheza.co.ke and patch them
def patch_vhost(block):
    """
    In the aviator vhost block:
    1. Remove lines: ProxyPass / http://127.0.0.1:5001/
                     ProxyPassReverse / http://127.0.0.1:5001/
    2. Remove any leftover: ProxyPass / http://127.0.0.1:3001/  (if previously added)
                            ProxyPassReverse / http://127.0.0.1:3001/
    3. Ensure AllowOverride All is set inside the <Directory> block
    4. Add ProxyPass /api ... and ProxyPassReverse /api ... (if not already present)
    """
    lines = block.split("\n")
    new_lines = []
    skip = False
    api_proxy_present = False
    in_directory = False

    for line in lines:
        stripped = line.strip()

        # Detect catch-all proxy lines (port 5001 or 3001 without /api prefix)
        if re.match(r'ProxyPass\s+/\s+http://127\.0\.0\.1:\d+/', stripped):
            print(f"  Removing: {stripped}")
            continue
        if re.match(r'ProxyPassReverse\s+/\s+http://127\.0\.0\.1:\d+/', stripped):
            print(f"  Removing: {stripped}")
            continue

        # Fix AllowOverride None → AllowOverride All
        if re.match(r'AllowOverride\s+None', stripped, re.I):
            line = line.replace("None", "All")
            print(f"  Fixed: AllowOverride None → AllowOverride All")

        # Track whether /api proxy is already present
        if f"ProxyPass /api http://127.0.0.1:{api_port}/api" in stripped:
            api_proxy_present = True

        new_lines.append(line)

    result = "\n".join(new_lines)

    # Insert the /api proxy after ProxyPass /.well-known ! if not already present
    if not api_proxy_present:
        well_known_pattern = r'(ProxyPass\s+/\.well-known\s+!)'
        replacement = (
            r'\1\n'
            f'ProxyPass /api http://127.0.0.1:{api_port}/api\n'
            f'ProxyPassReverse /api http://127.0.0.1:{api_port}/api'
        )
        new_result = re.sub(well_known_pattern, replacement, result, count=1)
        if new_result != result:
            print(f"  Added: ProxyPass /api http://127.0.0.1:{api_port}/api")
            result = new_result

    return result

# Patch every VirtualHost block that references the domain
def patch_all_vhosts(content, domain):
    # Split into VirtualHost blocks
    vhost_pattern = re.compile(
        r'(<VirtualHost[^>]*>.*?</VirtualHost>)',
        re.DOTALL | re.IGNORECASE
    )
    def maybe_patch(m):
        block = m.group(1)
        if domain in block:
            print(f"\n  [Patching vhost that contains {domain}]")
            return patch_vhost(block)
        return block
    return vhost_pattern.sub(maybe_patch, content)

new_content = patch_all_vhosts(content, domain)

with open(da_conf, "w") as f:
    f.write(new_content)

print("\n  Done patching httpd.conf.")
PYEOF

echo ""
echo "==> Testing Apache config syntax..."
if httpd -t 2>&1; then
  echo "    Syntax OK."
else
  echo ""
  echo "ERROR: Apache config syntax error. Restoring backup..."
  LATEST_BAK=$(ls -t "${DA_CONF}.bak."* | head -1)
  cp "$LATEST_BAK" "$DA_CONF"
  echo "    Backup restored: $LATEST_BAK"
  exit 1
fi

echo ""
echo "==> Reloading Apache..."
service httpd graceful || systemctl reload httpd

echo ""
echo "==> Verifying site responds..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Host: $DOMAIN" http://127.0.0.1/)
echo "    HTTP status (should be 200 or 301): $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
  echo ""
  echo "================================================================"
  echo " ✓  Apache fix complete! Site should now load."
  echo "    https://$DOMAIN"
  echo ""
  echo "    Verify API is also reachable:"
  echo "    curl https://$DOMAIN/api/health"
  echo "================================================================"
else
  echo ""
  echo "  WARNING: Got HTTP $HTTP_CODE. Check Apache error log:"
  echo "    tail -50 /var/log/httpd/domains/betcheza.co.ke.aviator.error.log"
  echo "    journalctl -xeu httpd --no-pager | tail -30"
fi
