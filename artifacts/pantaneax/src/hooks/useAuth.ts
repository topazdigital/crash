import { useClerk, useAuth as useClerkAuth, useUser } from "@clerk/react";
import { useEffect, useRef, useState } from "react";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
}

/** Maximum ms to wait for /api/me before giving up and showing the app unauthenticated. */
const FETCH_TIMEOUT_MS = 5_000;

/** Maximum ms to wait for Clerk to initialise before giving up. */
const CLERK_LOAD_TIMEOUT_MS = 8_000;

/** Build a minimal User from Clerk's own user object when the API is unreachable. */
function clerkUserToUser(clerkUser: ReturnType<typeof useUser>["user"]): User | null {
  if (!clerkUser) return null;
  const name =
    clerkUser.fullName ||
    clerkUser.username ||
    clerkUser.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "Player";
  const email = clerkUser.primaryEmailAddress?.emailAddress ?? "";
  return { id: clerkUser.id, name, email, phone: null, role: "user" };
}

export function useAuth() {
  const { isLoaded: clerkLoaded, isSignedIn } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Incremented to manually trigger a re-fetch of /api/me (e.g. after profile update)
  const [refreshTick, setRefreshTick] = useState(0);

  // Safety net: if Clerk never fires isLoaded (e.g. CDN blocked, bad key),
  // stop waiting after CLERK_LOAD_TIMEOUT_MS so the UI doesn't hang forever.
  const clerkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (clerkLoaded) {
      if (clerkTimerRef.current) clearTimeout(clerkTimerRef.current);
      return;
    }
    clerkTimerRef.current = setTimeout(() => {
      setIsLoading(false);
    }, CLERK_LOAD_TIMEOUT_MS);
    return () => {
      if (clerkTimerRef.current) clearTimeout(clerkTimerRef.current);
    };
  }, [clerkLoaded]);

  useEffect(() => {
    if (!clerkLoaded) return;
    if (!isSignedIn) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetch("/api/me", {
      credentials: "include",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load account");
        return response.json() as Promise<{ user: User }>;
      })
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        // API server is unavailable — fall back to Clerk's own user data so
        // the UI correctly reflects the signed-in state.
        if (!cancelled) setUser(clerkUserToUser(clerkUser));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clerkLoaded, isSignedIn, clerkUser?.id, refreshTick]);

  return {
    user,
    clerkUser,
    isLoading,
    isAuthenticated: Boolean(clerkLoaded && isSignedIn && user),
    logout: () => signOut({ redirectUrl: "/" }),
    /** Re-fetch /api/me (e.g. after updating profile name) */
    refreshUser: () => setRefreshTick((n) => n + 1),
  };
}
