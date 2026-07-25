import { useClerk, useAuth as useClerkAuth, useUser } from "@clerk/react";
import { useEffect, useState } from "react";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
}

export function useAuth() {
  const { isLoaded: clerkLoaded, isSignedIn } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!clerkLoaded) return;
    if (!isSignedIn) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    fetch("/api/me", { credentials: "include" })
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