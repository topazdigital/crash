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
const FETCH_TIMEOUT_MS = 10_000;

/** Maximum ms to wait for Clerk to initialise before giving up. */
const CLERK_LOAD_TIMEOUT_MS = 15_000;

export function useAuth() {
  const { isLoaded: clerkLoaded, isSignedIn } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

    // AbortSignal.timeout ensures the fetch fails (and loading clears) if the
    // API server hangs without sending a response — the most common cause of
    // the "Loading account..." infinite spinner on production VPS deployments.
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
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clerkLoaded, isSignedIn, clerkUser?.id]);

  return {
    user,
    clerkUser,
    isLoading,
    isAuthenticated: Boolean(clerkLoaded && isSignedIn && user),
    logout: () => signOut({ redirectUrl: "/" }),
  };
}