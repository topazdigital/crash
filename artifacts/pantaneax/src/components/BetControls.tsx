import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GamePhase } from '@/hooks/useGameEngine';

interface BetControlsProps {
  phase: GamePhase;
  multiplier: number;
  balance: number;
  onBet: (amount: number) => boolean;
  onCashout: (multiplier: number) => void;
  onLoss: () => void;
}

export default function BetControls({ phase, multiplier, balance, onBet, onCashout, onLoss }: BetControlsProps) {
  const [betAmount, setBetAmount] = useState('100');
  const [activeBet, setActiveBet] = useState<number | null>(null);
  const [cashedOut, setCashedOut] = useState(false);

  const handleBet = useCallback(() => {
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) return;
    if (onBet(amount)) {
      setActiveBet(amount);
      setCashedOut(false);
    }
  }, [betAmount, onBet]);

  const handleCashout = useCallback(() => {
    if (activeBet && !cashedOut) {
      onCashout(multiplier);
      setCashedOut(true);
    }
  }, [activeBet, cashedOut, multiplier, onCashout]);

  // Auto-reset on crash
  if (phase === 'crashed' && activeBet && !cashedOut) {
    onLoss();
    setActiveBet(null);
  }

  if (phase === 'waiting' && activeBet && cashedOut) {
    setActiveBet(null);
    setCashedOut(false);
  }

  const quickAmounts = [50, 100, 500, 1000];
  const canBet = phase === 'waiting' && !activeBet;
  const canCashout = phase === 'running' && activeBet && !cashedOut;
  const potentialWin = activeBet ? activeBet * multiplier : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Bet Amount (KES)</span>
        <span className="text-sm font-mono text-muted-foreground">
          Balance: <span className="text-foreground font-semibold">{balance.toFixed(2)}</span>
        </span>
      </div>

      <div className="flex gap-2">
        <Input
          type="number"
          value={betAmount}
          onChange={e => setBetAmount(e.target.value)}
          disabled={!canBet}
          className="font-mono text-lg bg-muted border-border"
          min={1}
          max={balance}
        />
      </div>

      <div className="grid grid-cols-4 gap-2">
        {quickAmounts.map(amount => (
          <Button
            key={amount}
            variant="secondary"
            size="sm"
            onClick={() => setBetAmount(String(amount))}
            disabled={!canBet}
            className="font-mono text-xs"
          >
            {amount}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setBetAmount(prev => String(Math.max(1, parseFloat(prev) / 2)))}
          disabled={!canBet}
        >
          ½
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setBetAmount(prev => String(Math.min(balance, parseFloat(prev) * 2)))}
          disabled={!canBet}
        >
          2×
        </Button>
      </div>

      {canCashout ? (
        <Button
          onClick={handleCashout}
          className="w-full h-14 text-lg font-bold bg-success hover:bg-success/90 text-success-foreground glow-success"
        >
          <div className="flex flex-col items-center">
            <span>CASH OUT</span>
            <span className="text-xs font-mono opacity-80">{potentialWin.toFixed(2)} KES</span>
          </div>
        </Button>
      ) : (
        <Button
          onClick={handleBet}
          disabled={!canBet}
          className="w-full h-14 text-lg font-bold glow-primary"
        >
          {activeBet ? (cashedOut ? `Won ${potentialWin.toFixed(2)} KES ✓` : 'Bet Active...') : 'PLACE BET'}
        </Button>
      )}

      {activeBet && (
        <div className="text-center text-sm text-muted-foreground font-mono">
          Bet: {activeBet.toFixed(2)} KES → {potentialWin.toFixed(2)} KES
        </div>
      )}
    </div>
  );
}
