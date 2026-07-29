import { Router, type IRouter, type RequestHandler } from "express";
import { count, desc, eq, sql } from "drizzle-orm";
import {
  betsTable,
  db,
  transactionsTable,
  usersTable,
  walletsTable,
} from "@workspace/db";
import { requireAdmin, requireUser } from "../middlewares/auth";

const router: IRouter = Router();
const adminOnly: RequestHandler[] = [requireUser, requireAdmin];

router.get("/admin/overview", ...adminOnly, async (_req, res, next) => {
  try {
    const [userCount] = await db.select({ count: count() }).from(usersTable);
    const [betCount] = await db.select({ count: count() }).from(betsTable);
    const [volume] = await db
      .select({ total: sql<string>`coalesce(sum(${betsTable.amount}), 0)` })
      .from(betsTable);
    const [payouts] = await db
      .select({ total: sql<string>`coalesce(sum(${betsTable.payout}), 0)` })
      .from(betsTable);
    res.json({
      users: Number(userCount?.count ?? 0),
      bets: Number(betCount?.count ?? 0),
      volume: Number(volume?.total ?? 0),
      payouts: Number(payouts?.total ?? 0),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/users", ...adminOnly, async (_req, res, next) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        balance: walletsTable.balance,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .leftJoin(walletsTable, eq(walletsTable.userId, usersTable.id))
      .orderBy(desc(usersTable.createdAt))
      .limit(100);
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/activity", ...adminOnly, async (_req, res, next) => {
  try {
    const activity = await db
      .select({
        id: transactionsTable.id,
        type: transactionsTable.type,
        amount: transactionsTable.amount,
        description: transactionsTable.description,
        createdAt: transactionsTable.createdAt,
        userName: usersTable.name,
        userEmail: usersTable.email,
      })
      .from(transactionsTable)
      .innerJoin(usersTable, eq(usersTable.id, transactionsTable.userId))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(100);
    res.json({ activity });
  } catch (error) {
    next(error);
  }
});

export default router;