---
name: MySQL database lock
description: The database is MySQL and must never be changed by any agent.
---

## Rule
This project uses **MySQL** exclusively as its database. No agent may:
- Change the database engine, dialect, or driver (e.g. do not migrate to PostgreSQL or SQLite)
- Run `drizzle-kit push`, `drizzle-kit generate`, or any schema migration commands
- Modify `lib/db/src/schema/index.ts` or any schema file without explicit user instruction
- Change `lib/db/drizzle.config.ts`
- Add, remove, or update the `mysql2` dependency

**Why:** The user's live production server requires MySQL. Schema or driver changes could corrupt or lose data on the live server.

**How to apply:** If any task or instruction involves touching the database layer (schema, driver, config, migrations), halt and ask the user explicitly before proceeding.
