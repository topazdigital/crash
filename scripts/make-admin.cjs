#!/usr/bin/env node
/**
 * Promote a user to admin by email.
 * Usage:  node scripts/make-admin.cjs your@email.com
 * Run from repo root:  cd /root/crashbet && node scripts/make-admin.cjs your@email.com
 */
"use strict";
const { readFileSync } = require("fs");
const { resolve } = require("path");

// ── Parse .env.production ──────────────────────────────────────────────────
const root = resolve(__dirname, "..");
const env = {};
try {
  for (const line of readFileSync(resolve(root, ".env.production"), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  console.error("Could not read .env.production — run from /root/crashbet");
  process.exit(1);
}

const mysqlUrl = env.MYSQL_URL || process.env.MYSQL_URL;
if (!mysqlUrl) { console.error("MYSQL_URL not found"); process.exit(1); }

const targetEmail = (process.argv[2] || "").trim();
if (!targetEmail) {
  console.error("Usage: node scripts/make-admin.cjs your@email.com");
  process.exit(1);
}

// ── Load mysql2 from workspace node_modules ────────────────────────────────
const mysql = require(resolve(root, "node_modules/mysql2/promise"));

(async () => {
  const conn = await mysql.createConnection(mysqlUrl);

  const [rows] = await conn.query(
    "SELECT email, name, role, created_at FROM users ORDER BY created_at"
  );
  console.log("\nRegistered users:");
  console.table(rows.map(r => ({ email: r.email, name: r.name, role: r.role })));

  const [result] = await conn.execute(
    "UPDATE users SET role = 'admin' WHERE email = ?",
    [targetEmail]
  );

  if (result.affectedRows === 0) {
    console.log(`\n⚠  No user found with email: ${targetEmail}`);
    console.log("Check the emails above — copy the exact stored email and retry.");
  } else {
    console.log(`\n✓  ${targetEmail} is now admin.`);
    console.log("   Sign out and sign back in, then go to /admin.");
  }

  await conn.end();
})().catch(e => { console.error(e.message); process.exit(1); });
