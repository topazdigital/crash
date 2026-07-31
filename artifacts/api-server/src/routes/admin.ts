import { Router, type IRouter, type RequestHandler } from "express";
import { count, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  betsTable,
  db,
  depositsTable,
  transactionsTable,
  usersTable,
  walletsTable,
  withdrawalsTable,
} from "@workspace/db";
import { requireAdmin, requireUser } from "../middlewares/auth";
import { sendMail, depositApprovedEmail } from "../lib/mailer.js";

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
    const [deposits] = await db
      .select({ total: sql<string>`coalesce(sum(${depositsTable.amount}), 0)` })
      .from(depositsTable)
      .where(eq(depositsTable.status, "completed"));
    const [withdrawals] = await db
      .select({ total: sql<string>`coalesce(sum(${withdrawalsTable.amount}), 0)` })
      .from(withdrawalsTable)
      .where(eq(withdrawalsTable.status, "completed"));
    res.json({
      users: Number(userCount?.count ?? 0),
      bets: Number(betCount?.count ?? 0),
      volume: Number(volume?.total ?? 0),
      payouts: Number(payouts?.total ?? 0),
      deposited: Number(deposits?.total ?? 0),
      withdrawn: Number(withdrawals?.total ?? 0),
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

router.get("/admin/deposits", ...adminOnly, async (_req, res, next) => {
  try {
    const deposits = await db
      .select({
        id: depositsTable.id,
        amount: depositsTable.amount,
        status: depositsTable.status,
        method: depositsTable.method,
        phone: depositsTable.phone,
        providerRef: depositsTable.providerRef,
        createdAt: depositsTable.createdAt,
        completedAt: depositsTable.completedAt,
        userName: usersTable.name,
        userEmail: usersTable.email,
      })
      .from(depositsTable)
      .innerJoin(usersTable, eq(usersTable.id, depositsTable.userId))
      .orderBy(desc(depositsTable.createdAt))
      .limit(100);
    res.json({ deposits });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/withdrawals", ...adminOnly, async (_req, res, next) => {
  try {
    const withdrawals = await db
      .select({
        id: withdrawalsTable.id,
        amount: withdrawalsTable.amount,
        status: withdrawalsTable.status,
        method: withdrawalsTable.method,
        phone: withdrawalsTable.phone,
        providerRef: withdrawalsTable.providerRef,
        createdAt: withdrawalsTable.createdAt,
        processedAt: withdrawalsTable.processedAt,
        userName: usersTable.name,
        userEmail: usersTable.email,
      })
      .from(withdrawalsTable)
      .innerJoin(usersTable, eq(usersTable.id, withdrawalsTable.userId))
      .orderBy(desc(withdrawalsTable.createdAt))
      .limit(100);
    res.json({ withdrawals });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/deposits/:id/approve
 * Marks a pending deposit as completed, credits the wallet, and emails the user.
 * Body: { note?: string }  — optional message included in the email
 */
router.post("/admin/deposits/:id/approve", ...adminOnly, async (req, res, next) => {
  try {
    const depositId = String(req.params.id);
    const adminNote = typeof req.body?.note === "string" ? req.body.note.trim() : undefined;

    const result = await db.transaction(async (tx) => {
      // Lock and fetch the deposit + user in one query
      const [row] = await tx
        .select({
          depositId: depositsTable.id,
          depositStatus: depositsTable.status,
          depositAmount: depositsTable.amount,
          userId: depositsTable.userId,
          userName: usersTable.name,
          userEmail: usersTable.email,
          walletId: walletsTable.id,
          walletBalance: walletsTable.balance,
        })
        .from(depositsTable)
        .innerJoin(usersTable, eq(usersTable.id, depositsTable.userId))
        .innerJoin(walletsTable, eq(walletsTable.userId, depositsTable.userId))
        .where(eq(depositsTable.id, depositId))
        .limit(1);

      if (!row) return { error: "Deposit not found" as const };
      if (row.depositStatus !== "pending") {
        return { error: `Deposit is already ${row.depositStatus}` as const };
      }

      const amount = Number(row.depositAmount);
      const newBalance = Number(row.walletBalance) + amount;

      await tx
        .update(walletsTable)
        .set({ balance: newBalance.toFixed(2) })
        .where(eq(walletsTable.id, row.walletId));

      await tx
        .update(depositsTable)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(depositsTable.id, depositId));

      await tx.insert(transactionsTable).values({
        id: randomUUID(),
        userId: row.userId,
        type: "deposit",
        amount: row.depositAmount,
        balanceAfter: newBalance.toFixed(2),
        reference: depositId,
        description: `Manual deposit approval: ${amount.toFixed(2)} KES`,
      });

      return {
        ok: true as const,
        userName: row.userName,
        userEmail: row.userEmail,
        amount: amount.toFixed(2),
        newBalance: newBalance.toFixed(2),
      };
    });

    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }

    // Send email asynchronously — don't block the response
    const emailContent = depositApprovedEmail({
      userName: result.userName,
      amount: result.amount,
      currency: "KES",
      newBalance: result.newBalance,
      adminNote: adminNote || "We apologise for the delay — our payment systems experienced a brief disruption. Your funds are now available.",
    });
    sendMail({ to: result.userEmail, ...emailContent }).catch(() => {/* logged inside sendMail */});

    res.json({ ok: true, newBalance: result.newBalance });
  } catch (error) {
    next(error);
  }
});

export default router;