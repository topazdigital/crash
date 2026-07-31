/**
 * Singleton Clerk backend client.
 * Used to look up real user data (emails, names) from Clerk's API
 * when JWT claims don't include them.
 */
import { createClerkClient } from "@clerk/express";

export const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

/**
 * Fetch the primary email address for a Clerk user.
 * Returns null if CLERK_SECRET_KEY is not set or the lookup fails.
 */
export async function getClerkUserEmail(clerkId: string): Promise<string | null> {
  if (!process.env.CLERK_SECRET_KEY) return null;
  try {
    const user = await clerk.users.getUser(clerkId);
    const primary = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId,
    );
    return primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch the display name for a Clerk user.
 * Returns null if the lookup fails.
 */
export async function getClerkUserName(clerkId: string): Promise<string | null> {
  if (!process.env.CLERK_SECRET_KEY) return null;
  try {
    const user = await clerk.users.getUser(clerkId);
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    return name || user.username || null;
  } catch {
    return null;
  }
}
