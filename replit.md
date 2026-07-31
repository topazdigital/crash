# CrashBet Hub

A real-time crash multiplier game with secure authentication, wallet management, demo & real gameplay modes, and a server-controlled crash engine.

## Stack

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui (artifact: `pantaneax`, path `/`)
- **Backend**: Express.js API server with Clerk auth + Drizzle ORM (artifact: `api-server`, path `/api`)
- **Database**: MySQL (via `mysql2` + Drizzle ORM) — **do not change**
- **Auth**: Clerk (JWT-based)
- **Monorepo**: pnpm workspace

## Project Structure

```
artifacts/
  pantaneax/      # React frontend
  api-server/     # Express API
lib/
  db/             # Drizzle ORM schema & connection (MySQL)
  api-spec/       # Shared API type definitions
  api-zod/        # Zod validation schemas
  api-client-react/ # React query hooks
```

## Running the App

The project has two managed artifact workflows:

- **Frontend**: `artifacts/pantaneax: web` — Vite dev server
- **API**: `artifacts/api-server: API Server` — Express server

Both start automatically when using the Run button.

## Required Environment Secrets

| Secret | Description |
|---|---|
| `MYSQL_URL` | MySQL connection string: `mysql://user:pass@host:3306/dbname` |
| `CLERK_SECRET_KEY` | Clerk backend secret key (starts with `sk_`) |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key (starts with `pk_`) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Same Clerk publishable key for the frontend |
| `VITE_CLERK_PROXY_URL` | Clerk proxy URL (e.g. `https://yourapp.replit.app/api/clerk`) |

## Optional Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ADMIN_EMAILS` | — | Comma-separated list of admin email addresses |
| `ADMIN_CLERK_IDS` | — | Comma-separated list of Clerk user IDs to grant admin (use when email isn't passed by Clerk JWT — find your ID in the `users` table's `clerk_id` column) |
| `LOG_LEVEL` | `info` | Logging level (`debug`, `info`, `warn`, `error`) |

## Database

- Driver: `mysql2`
- ORM: Drizzle ORM (`drizzle-orm/mysql2`)
- Connection: `MYSQL_URL` environment secret
- Schema: `lib/db/src/schema/index.ts`
- **Agents must never run migrations or modify the schema without explicit user instruction.**

## User Preferences

- Database is MySQL and must remain MySQL — never change the database engine, driver, schema, or run any migrations.
