import { useCallback, useEffect, useState } from "react";

export type TransactionType = "deposit" | "bet" | "win" | "loss" | "withdrawal";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: string;
  balanceAfter: string;
  createdAt: string;
  description: string;
}

interface WalletResponse {
  wallet: { balance: string; currency: string };
  transactions: Transaction[];
}

export function useWallet(isAuthenticated: boolean) {
  const [wallet, setWallet] = useState<WalletResponse>({
    wallet: { balance: "0.00", currency: "KES" },
    transactions: [],
  });
  const [loading, setLoading] = useState(isAuthenticated);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setWallet({
        wallet: { balance: "0.00", currency: "KES" },
        transactions: [],
      });
      return;
    }
    const response = await fetch("/api/me", { credentials: "include" });
    if (!response.ok) throw new Error("Unable to load wallet");
    const data = (await response.json()) as WalletResponse;
    setWallet(data);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [isAuthenticated, refresh]);

  const placeBet = useCallback(
    async (amount: number, roundId?: string) => {
      const response = await fetch("/api/game/bets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, roundId }),
      });
      if (!response.ok) return null;
      const result = (await response.json()) as {
        betId: string;
        balance: string;
      };
      setWallet((previous) => ({
        ...previous,
        wallet: { ...previous.wallet, balance: result.balance },
      }));
      return result.betId;
    },
    [],
  );

  const settleBet = useCallback(
    async (betId: string, multiplier: number, outcome: "win" | "loss") => {
      const response = await fetch(`/api/game/bets/${betId}/settle`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ multiplier, outcome }),
      });
      if (!response.ok) return false;
      await refresh();
      return true;
    },
    [refresh],
  );

  const updateBalance = useCallback((newBalance: number) => {
    setWallet((previous) => ({
      ...previous,
      wallet: { ...previous.wallet, balance: newBalance.toFixed(2) },
    }));
  }, []);

  return {
    balance: Number(wallet.wallet.balance),
    currency: wallet.wallet.currency,
    loading,
    placeBet,
    settleBet,
    refresh,
    updateBalance,
    transactions: wallet.transactions,
  };
}