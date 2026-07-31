#!/usr/bin/env node
/**
 * Promote a user to admin by email OR Clerk user ID.
 * Uses the system `mysql` CLI — no npm packages required.
 *
 * Usage (run from the repo root on the VPS):
 *   node scripts/make-admin.mjs your@email.com
 *   node scripts/make-admin.mjs user_3HARj9RepHg39vYX3Pmhen6WYFc
 */
import { readFileSync } from "fs";
import { execSync } from "child_process";
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

// Parse mysql://user:pass@host:port/dbname
const match = mysqlUrl.match(/^mysql:\/\/([^:]+):([^@]*)@([^:\/]+)(?::(\d+))?\/(.+)$/);
if (!match) {
  console.error("Could not parse MYSQL_URL — expected: mysql://user:pass@host:port/dbname");
  process.exit(1);
}
const [, user, pass, host, port = "3306", database] = match;

const target = process.argv[2]?.trim();
if (!target) {
  console.error("Usage: node scripts/make-admin.mjs <email or clerk_id>");
  console.error("  e.g. node scripts/make-admin.mjs your@email.com");
  console.error("  e.g. node scripts/make-admin.mjs user_3HARj9RepHg39vYX3Pmhen6WYFc");
  process.exit(1);
}

const isClerkId = target.startsWith("user_");
const field = isClerkId ? "clerk_id" : "email";

// Build mysql CLI args
const args = [
  `--host=${host}`,
  `--port=${port}`,
  `--user=${user}`,
  pass ? `--password=${pass}` : "--password=",
  `--database=${database}`,
  "--batch",
  "--silent",
];

function sql(query) {
  return execSync(`mysql ${args.join(" ")} -e ${JSON.stringify(query)}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

// Show all users
console.log("\nRegistered users:");
const rows = sql("SELECT clerk_id, email, name, role, created_at FROM users ORDER BY created_at;");
console.log(rows || "(no users found)");

// Promote
const escaped = target.replace(/'/g, "\\'");
const result = sql(
  `UPDATE users SET role='admin' WHERE ${field}='${escaped}'; SELECT ROW_COUNT() as affected;`
);

const affected = parseInt(result.trim().split("\n").pop() ?? "0", 10);
if (affected === 0) {
  console.log(`\n⚠  No user found with ${field}: ${target}`);
  console.log("Check the table above and try again.");
} else {
  console.log(`\n✓  ${target} is now admin.`);
  console.log("   Sign out and sign back in on the site, then go to /admin.");
}
