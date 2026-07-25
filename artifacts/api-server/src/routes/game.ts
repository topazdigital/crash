import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  betsTable,
  db,
  roundsTable,
  transactionsTable,
  walletsTable,
} from "@workspace/db";
import { requireUser } from "../middlewares/auth";

const router: IRouter = Router();

function amount(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.round(parsed * 100) / 100
    : null;
}

router.post("/game/bets", requireUser, async (req, res, next) => {
  try {
    const betAmount = amount(req.body?.amount);
    const roundId =
      typeof req.body?.roundId === "string" && req.body.roundId
        ? req.body.roundId
        : randomUUID();
    if (!betAmount) {
      res.status(400).json({ error: "A positive bet amount is required" });
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
      if (!wallet || balance < betAmount) {
        return { error: "Insufficient balance" as const };
      }
      await tx
        .update(walletsTable)
        .set({ balance: (balance - betAmount).toFixed(2) })
        .where(eq(walletsTable.userId, req.appUser!.id));
      const betId = randomUUID();
      await tx.insert(betsTable).values({
        id: betId,
        userId: req.appUser!.id,
        roundId,
        amount: betAmount.toFixed(2),
        status: "active",
      });
      await tx.insert(transactionsTable).values({
        id: randomUUID(),
        userId: req.appUser!.id,
        type: "bet",
        amount: betAmount.toFixed(2),
        balanceAfter: (balance - betAmount).toFixed(2),
        reference: betId,
        description: `Bet placed: ${betAmount.toFixed(2)} KES`,
      });
      return { betId, balance: (balance - betAmount).toFixed(2) };
    });

    if ("error" in result) {
      res.status(400).json(result);
      return;
    }
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/game/bets/:betId/settle", requireUser, async (req, res, next) => {
  try {
    const multiplier = amount(req.body?.multiplier);
    const outcome = req.body?.outcome === "win" ? "win" : "loss";
    if (!multiplier || multiplier < 1) {
      res.status(400).json({ error: "A valid multiplier is required" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const bet = (
        await tx
          .select()
          .from(betsTable)
          .where(eq(betsTable.id, req.params.betId))
          .limit(1)
      )[0];
      if (!bet || bet.userId !== req.appUser!.id || bet.status !== "active") {
        return { error: "Bet is not available" as const };
      }

      const payout =
        outcome === "win"
          ? Math.round(Number(bet.amount) * multiplier * 100) / 100
          : 0;
      const wallet = (
        await tx
          .select()
          .from(walletsTable)
          .where(eq(walletsTable.userId, req.appUser!.id))
          .limit(1)
      )[0];
      const balance = Number(wallet?.balance ?? 0);
      const nextBalance = balance + payout;
      await tx
        .update(betsTable)
        .set({
          status: outcome,
          cashoutMultiplier:
            outcome === "win" ? multiplier.toFixed(2) : null,
          payout: payout.toFixed(2),
          settledAt: new Date(),
        })
        .where(eq(betsTable.id, bet.id));
      if (payout > 0) {
        await tx
          .update(walletsTable)
          .set({ balance: nextBalance.toFixed(2) })
          .where(eq(walletsTable.userId, req.appUser!.id));
        await tx.insert(transactionsTable).values({
          id: randomUUID(),
          userId: req.appUser!.id,
          type: "win",
          amount: payout.toFixed(2),
          balanceAfter: nextBalance.toFixed(2),
          reference: bet.id,
          description: `Cashed out at ${multiplier.toFixed(2)}x`,
        });
      }
      return { payout: payout.toFixed(2), balance: nextBalance.toFixed(2) };
    });

    if ("error" in result) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/game/bets", requireUser, async (req, res, next) => {
  try {
    const bets = await db
      .select()
      .from(betsTable)
      .where(eq(betsTable.userId, req.appUser!.id))
      .orderBy(desc(betsTable.createdAt))
      .limit(50);
    res.json({ bets });
  } catch (error) {
    next(error);
  }
});

export default router;