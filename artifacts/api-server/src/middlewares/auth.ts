import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { db, usersTable, walletsTable } from "@workspace/db";
import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { getClerkUserEmail, getClerkUserName } from "../lib/clerk.js";

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

  // Try JWT claims first; fall back to Clerk backend API for real email/name
  const jwtEmail =
    claimString(req, "email") ??
    claimString(req, "primaryEmailAddress");
  const firstName = claimString(req, "firstName") ?? "";
  const lastName = claimString(req, "lastName") ?? "";
  const jwtName = [firstName, lastName].filter(Boolean).join(" ") || claimString(req, "name");

  // If JWT didn't include real data, look it up from Clerk API
  const [apiEmail, apiName] = (jwtEmail && jwtName)
    ? [null, null]
    : await Promise.all([
        jwtEmail ? null : getClerkUserEmail(auth.userId),
        jwtName  ? null : getClerkUserName(auth.userId),
      ]);

  const email = jwtEmail ?? apiEmail ?? `${auth.userId}@account.invalid`;
  const name = jwtName ?? apiName ?? email.split("@")[0] ?? "Player";
  const adminEmails = new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
  const adminClerkIds = new Set(
    (process.env.ADMIN_CLERK_IDS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const shouldBeAdmin =
    adminEmails.has(email.toLowerCase()) ||
    adminClerkIds.has(auth.userId);

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
  } else {
    // Patch stale/fake email or name whenever we have better data
    const needsEmailUpdate = user.email.endsWith("@account.invalid") && !email.endsWith("@account.invalid");
    const needsNameUpdate = (user.name === user.email.split("@")[0] || user.name === "Player") && name !== user.name;
    const updates: Record<string, unknown> = {};
    if (shouldBeAdmin && user.role !== "admin") updates.role = "admin";
    if (needsEmailUpdate) updates.email = email;
    if (needsNameUpdate) updates.name = name;
    if (Object.keys(updates).length > 0) {
      await db
        .update(usersTable)
        .set(updates)
        .where(and(eq(usersTable.id, user.id), eq(usersTable.clerkId, auth.userId)));
      user = { ...user, ...updates } as typeof user;
    }
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