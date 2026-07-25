import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  transactionsTable,
  usersTable,
  walletsTable,
} from "@workspace/db";
import { requireUser } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/me", requireUser, async (req, res, next) => {
  try {
    const user = req.appUser!;
    const wallet = (
      await db
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.userId, user.id))
        .limit(1)
    )[0];
    const transactions = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.userId, user.id))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(50);

    res.json({
      user,
      wallet: wallet ?? { balance: "0.00", currency: "KES" },
      transactions,
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/me/profile", requireUser, async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const phone =
      typeof req.body?.phone === "string" ? req.body.phone.trim() : null;
    if (!name || name.length > 160) {
      res.status(400).json({ error: "A valid name is required" });
      return;
    }
    await db
      .update(usersTable)
      .set({ name, phone })
      .where(eq(usersTable.id, req.appUser!.id));
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;