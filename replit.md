# PantaneAX

PantaneAX is a production-oriented crash game website with Clerk accounts, a MySQL-backed wallet/activity API, and a protected administrator dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes against MySQL
- Required secret: `MYSQL_URL` — MySQL connection string (`mysql://user:password@host:3306/database`)
- Required secret: `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — provisioned by managed authentication
- Required environment variable: `ADMIN_EMAILS` — comma-separated emails that receive the administrator role on first sign-in

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: MySQL + Drizzle ORM (`mysql2`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/index.ts` — MySQL tables for users, wallets, transactions, rounds, and bets
- `artifacts/api-server/src/routes/` — account, game, health, and admin API routes
- `artifacts/pantaneax/src/pages/Admin.tsx` — protected administrator dashboard

## Architecture decisions

- Clerk owns browser authentication; passwords are never stored in the browser or application database.
- A local user row is provisioned on the first authenticated API request and is linked by Clerk user ID.
- Administrator access is granted only to emails listed in `ADMIN_EMAILS`; all admin routes enforce the role server-side.

## Product

- Public visitors can view the game and sign in or register.
- Authenticated players use a persistent MySQL wallet and transaction history.
- Administrators can review users, balances, bet totals, payouts, and recent activity.

## User preferences

- User requires MySQL because their production server does not support PostgreSQL.
- User wants production behavior and no demo/local-storage credentials or demo mode.

## Gotchas

- Add `MYSQL_URL` and `ADMIN_EMAILS` before starting the API; the API intentionally fails without a database connection.
- Apply schema changes with the database package before using account, wallet, game, or admin routes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
