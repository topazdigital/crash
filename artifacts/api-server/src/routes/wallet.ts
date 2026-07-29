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
import { initiateStkPush, initiateWithdrawal, normalizePhone } from "../lib/payhero";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────

function parseAmount(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function callbackBase(): string {
  return (process.env.PAYHERO_CALLBACK_BASE_URL ?? "").replace(/\/$/, "");
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

/** GET /api/wallet/deposits/:depositId/status — poll deposit status */
router.get("/wallet/deposits/:depositId/status", requireUser, async (req, res, next) => {
  try {
    const deposit = (
      await db
        .select()
        .from(depositsTable)
        .where(eq(depositsTable.id, String(req.params.depositId)))
        .limit(1)
    )[0];

    if (!deposit || deposit.userId !== req.appUser!.id) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json({ status: deposit.status, method: deposit.method });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/wallet/deposits
 * Triggers an M-PESA STK push. Body: { amount: number, phone: string }
 */
router.post("/wallet/deposits", requireUser, async (req, res, next) => {
  try {
    const depositAmount = parseAmount(req.body?.amount);
    if (!depositAmount) {
      res.status(400).json({ error: "A positive deposit amount is required" });
      return;
    }

    const rawPhone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    if (!rawPhone) {
      res.status(400).json({ error: "Phone number is required for M-PESA" });
      return;
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhone(rawPhone);
    } catch {
      res.status(400).json({ error: "Invalid phone number. Use format 07XXXXXXXX or 254XXXXXXXXX" });
      return;
    }

    const depositId = randomUUID();
    await db.insert(depositsTable).values({
      id: depositId,
      userId: req.appUser!.id,
      amount: depositAmount.toFixed(2),
      method: "mpesa",
      phone: normalizedPhone,
      status: "pending",
    });

    const callbackUrl = `${callbackBase()}/api/wallet/payhero/callback`;
    const stkResult = await initiateStkPush({
      amount: depositAmount,
      phoneNumber: normalizedPhone,
      externalReference: depositId,
      callbackUrl,
    });

    if (!stkResult.success) {
      await db.update(depositsTable).set({ status: "failed" }).where(eq(depositsTable.id, depositId));
      res.status(502).json({ error: stkResult.error ?? "STK push failed. Please try again." });
      return;
    }

    logger.info({ depositId, phone: normalizedPhone, amount: depositAmount }, "STK push sent");

    res.status(201).json({
      depositId,
      status: "pending",
      message: stkResult.customerMessage ?? "Check your phone for an M-PESA prompt.",
    });
  } catch (err) {
    next(err);
  }
});

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
 * Deducts balance and initiates an M-PESA B2C payout.
 * Body: { amount: number, phone: string }
 */
router.post("/wallet/withdrawals", requireUser, async (req, res, next) => {
  try {
    const withdrawAmount = parseAmount(req.body?.amount);
    if (!withdrawAmount) {
      res.status(400).json({ error: "A positive withdrawal amount is required" });
      return;
    }

    const rawPhone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    if (!rawPhone) {
      res.status(400).json({ error: "Phone number is required for M-PESA withdrawal" });
      return;
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhone(rawPhone);
    } catch {
      res.status(400).json({ error: "Invalid phone number. Use format 07XXXXXXXX or 254XXXXXXXXX" });
      return;
    }

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
      await tx
        .update(walletsTable)
        .set({ balance: newBalance.toFixed(2) })
        .where(eq(walletsTable.userId, req.appUser!.id));

      const withdrawalId = randomUUID();
      await tx.insert(withdrawalsTable).values({
        id: withdrawalId,
        userId: req.appUser!.id,
        amount: withdrawAmount.toFixed(2),
        method: "mpesa",
        phone: normalizedPhone,
        status: "pending",
      });

      await tx.insert(transactionsTable).values({
        id: randomUUID(),
        userId: req.appUser!.id,
        type: "withdrawal",
        amount: withdrawAmount.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        reference: withdrawalId,
        description: `M-PESA withdrawal request: ${withdrawAmount.toFixed(2)} KES`,
      });

      return { withdrawalId, balance: newBalance.toFixed(2) };
    });

    if ("error" in result) {
      res.status(400).json(result);
      return;
    }

    // Trigger PayHero B2C payout
    const callbackUrl = `${callbackBase()}/api/wallet/payhero/withdrawal-callback`;
    const payoutResult = await initiateWithdrawal({
      amount: withdrawAmount,
      phoneNumber: normalizedPhone,
      externalReference: result.withdrawalId,
      callbackUrl,
    });

    if (!payoutResult.success) {
      // Payout couldn't be initiated — refund immediately
      await db.transaction(async (tx) => {
        const wallet = (
          await tx.select().from(walletsTable).where(eq(walletsTable.userId, req.appUser!.id)).limit(1)
        )[0];
        const refunded = Number(wallet?.balance ?? 0) + withdrawAmount;
        await tx.update(walletsTable).set({ balance: refunded.toFixed(2) }).where(eq(walletsTable.userId, req.appUser!.id));
        await tx.update(withdrawalsTable).set({ status: "failed" }).where(eq(withdrawalsTable.id, result.withdrawalId));
        await tx.insert(transactionsTable).values({
          id: randomUUID(),
          userId: req.appUser!.id,
          type: "refund",
          amount: withdrawAmount.toFixed(2),
          balanceAfter: refunded.toFixed(2),
          reference: result.withdrawalId,
          description: `Withdrawal failed — ${withdrawAmount.toFixed(2)} KES refunded`,
        });
      });
      res.status(502).json({ error: payoutResult.error ?? "Payout failed. Your balance has been restored." });
      return;
    }

    logger.info({ withdrawalId: result.withdrawalId, phone: normalizedPhone, amount: withdrawAmount }, "B2C payout sent");

    res.status(201).json({ status: "pending", balance: result.balance });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/wallet/withdrawals/:withdrawalId/cancel
 * Cancels a pending withdrawal and restores the balance.
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
          await tx.select().from(walletsTable).where(eq(walletsTable.userId, req.appUser!.id)).limit(1)
        )[0];
        const newBalance = Number(wallet?.balance ?? 0) + refundAmount;

        await tx.update(walletsTable).set({ balance: newBalance.toFixed(2) }).where(eq(walletsTable.userId, req.appUser!.id));
        await tx.update(withdrawalsTable).set({ status: "cancelled", processedAt: new Date() }).where(eq(withdrawalsTable.id, withdrawal.id));
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
