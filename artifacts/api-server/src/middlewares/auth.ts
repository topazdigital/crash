import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { db, usersTable, walletsTable } from "@workspace/db";
import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

type SessionClaims = Record<string, unknown>;

function claims(req: Request): SessionClaims {
  return (getAuth(req).sessionClaims ?? {}) as SessionClaims;
}

function claimString(req: Request, key: string): string | undefined {
  const value = claims(req)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

export async function resolveUser(req: Request) {
  const auth = getAuth(req);
  if (!auth.userId) return null;

  const email =
    claimString(req, "email") ??
    claimString(req, "primaryEmailAddress") ??
    `${auth.userId}@account.invalid`;
  const firstName = claimString(req, "firstName") ?? "";
  const lastName = claimString(req, "lastName") ?? "";
  const name =
    [firstName, lastName].filter(Boolean).join(" ") ||
    claimString(req, "name") ||
    email.split("@")[0] ||
    "Player";
  const adminEmails = new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
  const shouldBeAdmin = adminEmails.has(email.toLowerCase());

  let user = (
    await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, auth.userId))
      .limit(1)
  )[0];

  if (!user) {
    const id = randomUUID();
    await db.insert(usersTable).values({
      id,
      clerkId: auth.userId,
      email,
      name,
      role: shouldBeAdmin ? "admin" : "user",
    });
    await db.insert(walletsTable).values({
      id: randomUUID(),
      userId: id,
      balance: "0.00",
      currency: "KES",
    });
    user = (
      await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1)
    )[0];
  } else if (shouldBeAdmin && user.role !== "admin") {
    await db
      .update(usersTable)
      .set({ role: "admin", email, name })
      .where(and(eq(usersTable.id, user.id), eq(usersTable.clerkId, auth.userId)));
    user = { ...user, role: "admin", email, name };
  }

  return user;
}

export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const user = await resolveUser(req);
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    req.appUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.appUser?.role !== "admin") {
    res.status(403).json({ error: "Administrator access required" });
    return;
  }
  next();
}

declare global {
  namespace Express {
    interface Request {
      appUser?: typeof usersTable.$inferSelect;
    }
  }
}