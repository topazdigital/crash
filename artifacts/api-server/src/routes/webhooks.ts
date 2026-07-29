/**
 * PayHero payment callbacks — no Clerk auth required.
 * These are mounted BEFORE the Clerk middleware in app.ts.
 */
import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  depositsTable,
  transactionsTable,
  walletsTable,
  withdrawalsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * POST /api/wallet/payhero/callback
 * Called by PayHero after an STK push completes or fails.
 */
router.post("/wallet/payhero/callback", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const externalRef = body["external_reference"] as string | undefined;
    const success = body["success"] === true;
    const status = (body["status"] as string | undefined)?.toUpperCase();
    const mpesaRef = (
      (body["response"] as Record<string, unknown> | undefined)?.[
        "MpesaReceiptNumber"
      ] as string | undefined
    );

    logger.info({ externalRef, success, status }, "PayHero deposit callback");

    if (!externalRef) {
      res.status(400).json({ error: "Missing external_reference" });
      return;
    }

    if (!success || status !== "SUCCESS") {
      await db
        .update(depositsTable)
        .set({ status: "failed" })
        .where(eq(depositsTable.id, externalRef));
      res.json({ received: true });
      return;
    }

    await db.transaction(async (tx) => {
      const deposit = (
        await tx
          .select()
          .from(depositsTable)
          .where(eq(depositsTable.id, externalRef))
          .limit(1)
      )[0];

      if (!deposit || deposit.status !== "pending") return;

      const depositAmount = Number(deposit.amount);
      const wallet = (
        await tx
          .select()
          .from(walletsTable)
          .where(eq(walletsTable.userId, deposit.userId))
          .limit(1)
      )[0];
      const newBalance = Number(wallet?.balance ?? 0) + depositAmount;

      await tx
        .update(walletsTable)
        .set({ balance: newBalance.toFixed(2) })
        .where(eq(walletsTable.userId, deposit.userId));

      await tx
        .update(depositsTable)
        .set({ status: "completed", providerRef: mpesaRef ?? null, completedAt: new Date() })
        .where(eq(depositsTable.id, externalRef));

      await tx.insert(transactionsTable).values({
        id: randomUUID(),
        userId: deposit.userId,
        type: "deposit",
        amount: deposit.amount,
        balanceAfter: newBalance.toFixed(2),
        reference: externalRef,
        description: `M-PESA deposit${mpesaRef ? ` (${mpesaRef})` : ""}: ${depositAmount.toFixed(2)} KES`,
      });
    });

    res.json({ received: true });
  } catch (err) {
    logger.error({ err }, "Error processing PayHero deposit callback");
    next(err);
  }
});

/**
 * POST /api/wallet/payhero/withdrawal-callback
 * Called by PayHero after a B2C payout completes or fails.
 */
router.post("/wallet/payhero/withdrawal-callback", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const externalRef = body["external_reference"] as string | undefined;
    const success = body["success"] === true;
    const status = (body["status"] as string | undefined)?.toUpperCase();
    const mpesaRef = (
      (body["response"] as Record<string, unknown> | undefined)?.[
        "MpesaReceiptNumber"
      ] as string | undefined
    );

    logger.info({ externalRef, success, status }, "PayHero withdrawal callback");

    if (!externalRef) {
      res.status(400).json({ error: "Missing external_reference" });
      return;
    }

    if (success && status === "SUCCESS") {
      await db
        .update(withdrawalsTable)
        .set({ status: "completed", providerRef: mpesaRef ?? null, processedAt: new Date() })
        .where(eq(withdrawalsTable.id, externalRef));
    } else {
      // Payout failed — refund the balance
      await db.transaction(async (tx) => {
        const withdrawal = (
          await tx
            .select()
            .from(withdrawalsTable)
            .where(eq(withdrawalsTable.id, externalRef))
            .limit(1)
        )[0];

        if (!withdrawal || withdrawal.status !== "pending") return;

        const refundAmount = Number(withdrawal.amount);
        const wallet = (
          await tx
            .select()
            .from(walletsTable)
            .where(eq(walletsTable.userId, withdrawal.userId))
            .limit(1)
        )[0];
        const newBalance = Number(wallet?.balance ?? 0) + refundAmount;

        await tx
          .update(walletsTable)
          .set({ balance: newBalance.toFixed(2) })
          .where(eq(walletsTable.userId, withdrawal.userId));

        await tx
          .update(withdrawalsTable)
          .set({ status: "failed", processedAt: new Date() })
          .where(eq(withdrawalsTable.id, externalRef));

        await tx.insert(transactionsTable).values({
          id: randomUUID(),
          userId: withdrawal.userId,
          type: "refund",
          amount: withdrawal.amount,
          balanceAfter: newBalance.toFixed(2),
          reference: externalRef,
          description: `Withdrawal failed — ${refundAmount.toFixed(2)} KES refunded`,
        });
      });
    }

    res.json({ received: true });
  } catch (err) {
    logger.error({ err }, "Error processing PayHero withdrawal callback");
    next(err);
  }
});

export default router;
