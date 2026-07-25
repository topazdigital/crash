import { useState, useCallback } from 'react';

export type GameMode = 'demo' | 'real';
export type TransactionType = 'deposit' | 'bet' | 'win' | 'loss' | 'withdrawal';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  mode: GameMode;
  timestamp: Date;
  description: string;
}

interface WalletState {
  balanceDemo: number;
  balanceReal: number;
  transactions: Transaction[];
}

const INITIAL_DEMO_BALANCE = 10000;

function loadWallet(): WalletState {
  try {
    const saved = localStorage.getItem('aviator_wallet');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        transactions: parsed.transactions.map((t: any) => ({
          ...t,
          timestamp: new Date(t.timestamp),
        })),
      };
    }
  } catch {}
  return { balanceDemo: INITIAL_DEMO_BALANCE, balanceReal: 0, transactions: [] };
}

function saveWallet(state: WalletState) {
  localStorage.setItem('aviator_wallet', JSON.stringify(state));
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>(loadWallet);
  const [mode, setMode] = useState<GameMode>('demo');

  const balance = mode === 'demo' ? wallet.balanceDemo : wallet.balanceReal;

  const addTransaction = useCallback((type: TransactionType, amount: number, description: string) => {
    setWallet(prev => {
      const tx: Transaction = {
        id: crypto.randomUUID(),
        type,
        amount,
        mode: 'demo',
        timestamp: new Date(),
        description,
      };
      const balanceKey = 'balanceDemo';
      let delta = 0;
      if (type === 'deposit' || type === 'win') delta = amount;
      else if (type === 'bet' || type === 'loss' || type === 'withdrawal') delta = -amount;

      const next = {
        ...prev,
        [balanceKey]: Math.max(0, prev[balanceKey] + delta),
        transactions: [tx, ...prev.transactions].slice(0, 100),
      };
      saveWallet(next);
      return next;
    });
  }, []);

  const placeBet = useCallback((amount: number): boolean => {
    if (amount <= 0 || amount > (mode === 'demo' ? wallet.balanceDemo : wallet.balanceReal)) return false;
    addTransaction('bet', amount, `Bet placed: ${amount.toFixed(2)} KES`);
    return true;
  }, [mode, wallet.balanceDemo, wallet.balanceReal, addTransaction]);

  const creditWin = useCallback((amount: number, multiplier: number) => {
    addTransaction('win', amount, `Cashed out at ${multiplier.toFixed(2)}x — Won ${amount.toFixed(2)} KES`);
  }, [addTransaction]);

  const recordLoss = useCallback((amount: number) => {
    addTransaction('loss', 0, `Crashed — Lost ${amount.toFixed(2)} KES`);
  }, [addTransaction]);

  const depositDemo = useCallback((amount: number) => {
    addTransaction('deposit', amount, `Demo deposit: ${amount.toFixed(2)} KES`);
  }, [addTransaction]);

  const resetDemo = useCallback(() => {
    setWallet(prev => {
      const next = { ...prev, balanceDemo: INITIAL_DEMO_BALANCE };
      saveWallet(next);
      return next;
    });
  }, []);

  return {
    balance,
    mode,
    setMode,
    wallet,
    placeBet,
    creditWin,
    recordLoss,
    depositDemo,
    resetDemo,
    transactions: wallet.transactions,
  };
}
