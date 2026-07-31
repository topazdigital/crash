#!/usr/bin/env node
/**
 * Promote a user to admin by email OR Clerk user ID.
 * Usage:
 *   node scripts/make-admin.mjs your@email.com
 *   node scripts/make-admin.mjs user_xxxxxxxxxxxxxxxxxxxxxxxxxx
 *
 * Run from the repo root on the VPS:
 *   cd /root/crashbet && node scripts/make-admin.mjs your@email.com
 *   cd /root/crashbet && node scripts/make-admin.mjs user_3HARj9RepHg39vYX3Pmhen6WYFc
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(fileURLToPath(import.meta.url), "../../");

// ── Parse .env.production ──────────────────────────────────────────────────
const env = {};
try {
  for (const line of readFileSync(resolve(root, ".env.production"), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  console.error("Could not read .env.production — run from /root/crashbet");
  process.exit(1);
}

const mysqlUrl = env.MYSQL_URL ?? process.env.MYSQL_URL;
if (!mysqlUrl) {
  console.error("MYSQL_URL not found in .env.production");
  process.exit(1);
}

const target = process.argv[2]?.trim();
if (!target) {
  console.error("Usage: node scripts/make-admin.mjs <email or clerk_id>");
  console.error("  e.g. node scripts/make-admin.mjs your@email.com");
  console.error("  e.g. node scripts/make-admin.mjs user_3HARj9RepHg39vYX3Pmhen6WYFc");
  process.exit(1);
}

// ── Connect ────────────────────────────────────────────────────────────────
const { createConnection } = await import("mysql2/promise");
const conn = await createConnection(mysqlUrl);

// Show all users so the operator can verify
const [rows] = await conn.query(
  "SELECT clerk_id, email, name, role, created_at FROM users ORDER BY created_at"
);
console.log("\nRegistered users:");
console.table(rows);

// Determine whether the argument is a Clerk ID or an email
const isClerkId = target.startsWith("user_");
const [result] = isClerkId
  ? await conn.execute("UPDATE users SET role = 'admin' WHERE clerk_id = ?", [target])
  : await conn.execute("UPDATE users SET role = 'admin' WHERE email = ?", [target]);

if (result.affectedRows === 0) {
  console.log(`\n⚠  No user found with ${isClerkId ? "clerk_id" : "email"}: ${target}`);
  console.log("Check the table above and try again with the correct value.");
} else {
  console.log(`\n✓  ${target} is now admin (${result.affectedRows} row updated).`);
  console.log("   Sign out and sign back in on the site, then go to /admin.");
}

await conn.end();
