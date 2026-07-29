import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  db,
  depositsTable,
  transactionsTable,
  walletsTable,
  withdrawalsTable,
} from "@workspace/db";
import { requireUser } from "../middlewares/auth";

const router: IRouter = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────

function parseAmount(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// ─── Deposits ─────────────────────────────────────────────────────────────────

/** GET /api/wallet/deposits — list the current user's deposits */
router.get("/wallet/deposits", requireUser, async (req, res, next) => {
  try {
    const deposits = await db
      .select()
      .from(depositsTable)
      .where(eq(depositsTable.userId, req.appUser!.id))
      .orderBy(desc(depositsTable.createdAt))
      .limit(50);
    res.json({ deposits });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/wallet/deposits
 * Initiate a deposit request.
 * Body: { amount: number, method?: string, phone?: string }
 * The deposit starts as "pending". A real implementation would trigger an
 * M-PESA STK push here and complete the deposit via a webhook callback.
 */
router.post("/wallet/deposits", requireUser, async (req, res, next) => {
  try {
    const depositAmount = parseAmount(req.body?.amount);
    if (!depositAmount) {
      res.status(400).json({ error: "A positive deposit amount is required" });
      return;
    }
    const method =
      typeof req.body?.method === "string" ? req.body.method : "mpesa";
    const phone =
      typeof req.body?.phone === "string" ? req.body.phone.trim() || null : null;

    const depositId = randomUUID();
    await db.insert(depositsTable).values({
      id: depositId,
      userId: req.appUser!.id,
      amount: depositAmount.toFixed(2),
      method,
      phone,
      status: "pending",
    });

    res.status(201).json({ depositId, status: "pending" });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/wallet/deposits/:depositId/confirm  (admin or payment-webhook)
 * Marks a pending deposit as completed and credits the wallet.
 * Body: { providerRef?: string }
 */
router.post(
  "/wallet/deposits/:depositId/confirm",
  requireUser,
  async (req, res, next) => {
    try {
      const depositId = req.params.depositId;
      const providerRef =
        typeof req.body?.providerRef === "string"
          ? req.body.providerRef.trim() || null
          : null;

      const result = await db.transaction(async (tx) => {
        const deposit = (
          await tx
            .select()
            .from(depositsTable)
            .where(eq(depositsTable.id, String(depositId)))
            .limit(1)
        )[0];

        if (!deposit || deposit.userId !== req.appUser!.id) {
          return { error: "Deposit not found" as const };
        }
        if (deposit.status !== "pending") {
          return { error: "Deposit is not pending" as const };
        }

        const depositAmount = Number(deposit.amount);

        // Credit wallet
        const wallet = (
          await tx
            .select()
            .from(walletsTable)
            .where(eq(walletsTable.userId, req.appUser!.id))
            .limit(1)
        )[0];
        const newBalance = Number(wallet?.balance ?? 0) + depositAmount;

        await tx
          .update(walletsTable)
          .set({ balance: newBalance.toFixed(2) })
          .where(eq(walletsTable.userId, req.appUser!.id));

        // Mark deposit complete
        await tx
          .update(depositsTable)
          .set({
            status: "completed",
            providerRef,
            completedAt: new Date(),
          })
          .where(eq(depositsTable.id, String(depositId)));

        // Write transaction record
        await tx.insert(transactionsTable).values({
          id: randomUUID(),
          userId: req.appUser!.id,
          type: "deposit",
          amount: deposit.amount,
          balanceAfter: newBalance.toFixed(2),
          reference: String(depositId),
          description: `Deposit via ${deposit.method}: ${depositAmount.toFixed(2)} KES`,
        });

        return { balance: newBalance.toFixed(2) };
      });

      if ("error" in result) {
        res.status(400).json(result);
        return;
      }
      res.json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Withdrawals ──────────────────────────────────────────────────────────────

/** GET /api/wallet/withdrawals — list the current user's withdrawals */
router.get("/wallet/withdrawals", requireUser, async (req, res, next) => {
  try {
    const withdrawals = await db
      .select()
      .from(withdrawalsTable)
      .where(eq(withdrawalsTable.userId, req.appUser!.id))
      .orderBy(desc(withdrawalsTable.createdAt))
      .limit(50);
    res.json({ withdrawals });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/wallet/withdrawals
 * Request a withdrawal.
 * Body: { amount: number, method?: string, phone?: string, accountDetails?: string }
 * Balance is immediately deducted (held) and the withdrawal starts as "pending".
 */
router.post("/wallet/withdrawals", requireUser, async (req, res, next) => {
  try {
    const withdrawAmount = parseAmount(req.body?.amount);
    if (!withdrawAmount) {
      res
        .status(400)
        .json({ error: "A positive withdrawal amount is required" });
      return;
    }
    const method =
      typeof req.body?.method === "string" ? req.body.method : "mpesa";
    const phone =
      typeof req.body?.phone === "string" ? req.body.phone.trim() || null : null;
    const accountDetails =
      typeof req.body?.accountDetails === "string"
        ? req.body.accountDetails.trim() || null
        : null;

    const result = await db.transaction(async (tx) => {
      const wallet = (
        await tx
          .select()
          .from(walletsTable)
          .where(eq(walletsTable.userId, req.appUser!.id))
          .limit(1)
      )[0];
      const balance = Number(wallet?.balance ?? 0);

      if (!wallet || balance < withdrawAmount) {
        return { error: "Insufficient balance" as const };
      }

      const newBalance = balance - withdrawAmount;

      // Deduct balance immediately (hold funds)
      await tx
        .update(walletsTable)
        .set({ balance: newBalance.toFixed(2) })
        .where(eq(walletsTable.userId, req.appUser!.id));

      const withdrawalId = randomUUID();
      await tx.insert(withdrawalsTable).values({
        id: withdrawalId,
        userId: req.appUser!.id,
        amount: withdrawAmount.toFixed(2),
        method,
        phone,
        accountDetails,
        status: "pending",
      });

      // Record transaction
      await tx.insert(transactionsTable).values({
        id: randomUUID(),
        userId: req.appUser!.id,
        type: "withdrawal",
        amount: withdrawAmount.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        reference: withdrawalId,
        description: `Withdrawal request via ${method}: ${withdrawAmount.toFixed(2)} KES`,
      });

      return { withdrawalId, balance: newBalance.toFixed(2) };
    });

    if ("error" in result) {
      res.status(400).json(result);
      return;
    }
    res.status(201).json({ status: "pending", ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/wallet/withdrawals/:withdrawalId/cancel
 * User cancels a pending withdrawal — balance is restored.
 */
router.post(
  "/wallet/withdrawals/:withdrawalId/cancel",
  requireUser,
  async (req, res, next) => {
    try {
      const result = await db.transaction(async (tx) => {
        const withdrawal = (
          await tx
            .select()
            .from(withdrawalsTable)
            .where(eq(withdrawalsTable.id, String(req.params.withdrawalId)))
            .limit(1)
        )[0];

        if (!withdrawal || withdrawal.userId !== req.appUser!.id) {
          return { error: "Withdrawal not found" as const };
        }
        if (withdrawal.status !== "pending") {
          return { error: "Only pending withdrawals can be cancelled" as const };
        }

        const refundAmount = Number(withdrawal.amount);
        const wallet = (
          await tx
            .select()
            .from(walletsTable)
            .where(eq(walletsTable.userId, req.appUser!.id))
            .limit(1)
        )[0];
        const newBalance = Number(wallet?.balance ?? 0) + refundAmount;

        await tx
          .update(walletsTable)
          .set({ balance: newBalance.toFixed(2) })
          .where(eq(walletsTable.userId, req.appUser!.id));

        await tx
          .update(withdrawalsTable)
          .set({ status: "cancelled", processedAt: new Date() })
          .where(eq(withdrawalsTable.id, withdrawal.id));

        await tx.insert(transactionsTable).values({
          id: randomUUID(),
          userId: req.appUser!.id,
          type: "refund",
          amount: withdrawal.amount,
          balanceAfter: newBalance.toFixed(2),
          reference: withdrawal.id,
          description: `Withdrawal cancelled — ${refundAmount.toFixed(2)} KES refunded`,
        });

        return { balance: newBalance.toFixed(2) };
      });

      if ("error" in result) {
        res.status(400).json(result);
        return;
      }
      res.json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
