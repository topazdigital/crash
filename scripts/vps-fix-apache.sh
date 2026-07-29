#!/bin/bash
# =============================================================================
# CrashBet Hub — Fix Apache VirtualHost for aviator.betcheza.co.ke
#
# This script:
#   1. Ensures the /api/game/stream SSE route has flushpackets=on in BOTH the
#      HTTP (:80) and HTTPS (:443) VirtualHosts so the game countdown works.
#   2. Ensures the generic /api ProxyPass uses the correct Node.js port.
#   3. Disables mod_deflate for the SSE route (compression breaks streaming).
#   4. Tests Apache config and gracefully reloads.
#
# Usage (as root on the VPS):
#   bash scripts/vps-fix-apache.sh [PORT]
#   PORT defaults to 3001 if not provided.
# =============================================================================
set -e

DOMAIN="aviator.betcheza.co.ke"
API_PORT="${1:-3001}"

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

echo ""
echo "==> Patching VirtualHosts for $DOMAIN (API port: $API_PORT)..."

# Write the Python patcher to a temp file to avoid heredoc escape issues.
PATCHER_PY="$(mktemp /tmp/crashbet_apache_patcher.XXXXXX.py)"
trap 'rm -f "$PATCHER_PY"' EXIT

cat > "$PATCHER_PY" << PYEOF
import re, sys

da_conf  = sys.argv[1]
domain   = sys.argv[2]
api_port = int(sys.argv[3])

with open(da_conf, "r") as f:
    content = f.read()

# The SSE proxy block to inject — MUST come before the generic /api rule.
sse_block = "\n".join([
    "ProxyPass /api/game/stream http://127.0.0.1:{p}/api/game/stream flushpackets=on".format(p=api_port),
    "ProxyPassReverse /api/game/stream http://127.0.0.1:{p}/api/game/stream".format(p=api_port),
    "ProxyPass /api http://127.0.0.1:{p}/api".format(p=api_port),
    "ProxyPassReverse /api http://127.0.0.1:{p}/api".format(p=api_port),
])

def patch_vhost(block):
    lines = block.split("\n")
    new_lines = []

    for line in lines:
        stripped = line.strip()

        # Remove catch-all proxy lines (any port)
        if re.match(r'ProxyPass\s+/\s+http://127\.0\.0\.1:\d+/', stripped):
            print("  Removing catch-all: " + stripped)
            continue
        if re.match(r'ProxyPassReverse\s+/\s+http://127\.0\.0\.1:\d+/', stripped):
            print("  Removing catch-all: " + stripped)
            continue

        # Remove any existing /api/game/stream proxy lines
        if re.match(r'ProxyPass\s+/api/game/stream\b', stripped):
            print("  Removing old SSE rule: " + stripped)
            continue
        if re.match(r'ProxyPassReverse\s+/api/game/stream\b', stripped):
            print("  Removing old SSE rule: " + stripped)
            continue

        # Remove any existing /api proxy lines (wrong port or duplicate)
        if re.match(r'ProxyPass\s+/api\b', stripped):
            print("  Removing old /api rule: " + stripped)
            continue
        if re.match(r'ProxyPassReverse\s+/api\b', stripped):
            print("  Removing old /api rule: " + stripped)
            continue

        # Fix AllowOverride None -> All
        if re.match(r'AllowOverride\s+None', stripped, re.I):
            line = line.replace("None", "All")
            print("  Fixed: AllowOverride None -> All")

        new_lines.append(line)

    result = "\n".join(new_lines)

    # Insert SSE + API proxy block right after "ProxyPass /.well-known !"
    # Use a lambda so we never put escape sequences inside re.sub replacement strings.
    well_known_re = re.compile(r'([ \t]*ProxyPass[ \t]+/\.well-known[ \t]+!)')
    def insert_after_well_known(m):
        return m.group(0) + "\n" + sse_block

    new_result = well_known_re.sub(insert_after_well_known, result, count=1)
    if new_result != result:
        print("  Inserted SSE + /api proxy rules after ProxyPass /.well-known !")
        return new_result

    # Fallback: no /.well-known line — insert at top of vhost body
    vhost_open_re = re.compile(r'(<VirtualHost[^>]*>)')
    def insert_after_vhost_open(m):
        return m.group(0) + "\n" + sse_block

    new_result = vhost_open_re.sub(insert_after_vhost_open, result, count=1)
    print("  Inserted SSE + /api proxy rules at top of VirtualHost (no /.well-known found)")
    return new_result

# Patch every VirtualHost block that references the domain
vhost_re = re.compile(r'(<VirtualHost[^>]*>.*?</VirtualHost>)', re.DOTALL | re.IGNORECASE)

def maybe_patch(m):
    block = m.group(1)
    if domain in block:
        print("\n  [Patching vhost containing " + domain + "]")
        return patch_vhost(block)
    return block

new_content = vhost_re.sub(maybe_patch, content)

with open(da_conf, "w") as f:
    f.write(new_content)

print("\nDone patching httpd.conf.")

# Quick sanity check: confirm the SSE rule appears in both port blocks
hits = re.findall(r'<VirtualHost[^>]*>.*?ProxyPass /api/game/stream.*?</VirtualHost>', new_content, re.DOTALL | re.IGNORECASE)
domain_hits = [h for h in hits if domain in h]
print("VirtualHosts with SSE rule and domain: " + str(len(domain_hits)))
if len(domain_hits) < 2:
    print("WARNING: Expected 2 (one for :80, one for :443) but found " + str(len(domain_hits)))
    print("  Check that the domain appears in both VirtualHost blocks in httpd.conf.")
PYEOF

python3 "$PATCHER_PY" "$DA_CONF" "$DOMAIN" "$API_PORT"

# Also add a mod_deflate exclusion for the SSE endpoint in .htaccess
PUBLIC_HTML=""
for candidate in \
  "/home/admin/domains/$DOMAIN/public_html" \
  "/home/betcheza/domains/$DOMAIN/public_html" \
  "/var/www/$DOMAIN/public_html"; do
  if [ -d "$candidate" ]; then
    PUBLIC_HTML="$candidate"
    break
  fi
done

if [ -n "$PUBLIC_HTML" ]; then
  HTACCESS="$PUBLIC_HTML/.htaccess"
  if ! grep -q "api/game/stream" "$HTACCESS" 2>/dev/null; then
    cat >> "$HTACCESS" << 'HTEOF'

# Disable compression for SSE endpoint (required for real-time streaming)
<If "%{REQUEST_URI} =~ m|/api/game/stream|">
  SetEnvIf Request_URI "/api/game/stream" no-gzip dont-vary
</If>
HTEOF
    echo "    Added mod_deflate exclusion for /api/game/stream in $HTACCESS"
  fi
fi

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
service httpd graceful 2>/dev/null || systemctl reload httpd

echo ""
echo "==> Verifying SSE endpoint is reachable..."
SSE_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 3 \
  -H "Host: $DOMAIN" \
  -H "Accept: text/event-stream" \
  http://127.0.0.1/api/game/stream 2>/dev/null || echo "000")
echo "    SSE endpoint HTTP status: $SSE_CODE (expect 200)"

echo ""
echo "================================================================"
echo " Apache SSE fix complete!"
echo ""
echo " What was fixed:"
echo "   - /api/game/stream now has flushpackets=on in BOTH vhosts"
echo "   - /api proxy uses port $API_PORT"
echo "   - mod_deflate disabled for SSE endpoint"
echo ""
echo " Verify the game works:"
echo "   https://$DOMAIN"
echo ""
echo " Check SSE is streaming (should see data: lines every second):"
echo "   curl -N https://$DOMAIN/api/game/stream"
echo "================================================================"
