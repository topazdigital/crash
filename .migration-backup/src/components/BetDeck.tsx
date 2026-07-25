import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GamePhase } from '@/hooks/useGameEngine';
import { Bot } from 'lucide-react';

interface BetDeckProps {
  label: string;
  phase: GamePhase;
  multiplier: number;
  balance: number;
  onBet: (amount: number) => boolean;
  onCashout: (multiplier: number) => void;
  onLoss: () => void;
}

export default function BetDeck({ label, phase, multiplier, balance, onBet, onCashout, onLoss }: BetDeckProps) {
  const [betAmount, setBetAmount] = useState('100');
  const [activeBet, setActiveBet] = useState<number | null>(null);
  const [cashedOut, setCashedOut] = useState(false);

  // Auto-bet state
  const [autoBet, setAutoBet] = useState(false);
  const [autoCashout, setAutoCashout] = useState('2.00');
  const autoBetRef = useRef(false);
  const autoCashoutRef = useRef(2.0);

  // Keep refs in sync
  useEffect(() => { autoBetRef.current = autoBet; }, [autoBet]);
  useEffect(() => { autoCashoutRef.current = parseFloat(autoCashout) || 2.0; }, [autoCashout]);

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

  // Auto-cashout at target multiplier
  useEffect(() => {
    if (phase === 'running' && activeBet && !cashedOut && autoBetRef.current) {
      const target = autoCashoutRef.current;
      if (multiplier >= target) {
        onCashout(multiplier);
        setCashedOut(true);
      }
    }
  }, [multiplier, phase, activeBet, cashedOut, onCashout]);

  // Auto-reset on crash
  if (phase === 'crashed' && activeBet && !cashedOut) {
    onLoss();
    setActiveBet(null);
  }

  // Reset after cashout when new round starts
  if (phase === 'waiting' && activeBet && cashedOut) {
    setActiveBet(null);
    setCashedOut(false);
  }

  // Auto-bet: place bet automatically when waiting phase starts
  useEffect(() => {
    if (phase === 'waiting' && autoBetRef.current && !activeBet) {
      const timer = setTimeout(() => {
        if (autoBetRef.current) {
          const amount = parseFloat(betAmount);
          if (!isNaN(amount) && amount > 0 && amount <= balance) {
            if (onBet(amount)) {
              setActiveBet(amount);
              setCashedOut(false);
            }
          }
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [phase, autoBet, activeBet, betAmount, balance, onBet]);

  const quickAmounts = [50, 100, 500, 1000];
  const canBet = phase === 'waiting' && !activeBet && !autoBet;
  const canCashout = phase === 'running' && activeBet && !cashedOut;
  const potentialWin = activeBet ? activeBet * multiplier : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-xs font-mono text-muted-foreground">
          Bal: <span className="text-foreground font-semibold">{balance.toFixed(0)}</span>
        </span>
      </div>

      <Input
        type="number"
        value={betAmount}
        onChange={e => setBetAmount(e.target.value)}
        disabled={!canBet && !autoBet}
        className="font-mono text-sm bg-muted border-border h-9"
        min={1}
        max={balance}
      />

      <div className="grid grid-cols-4 gap-1.5">
        {quickAmounts.map(amount => (
          <Button
            key={amount}
            variant="secondary"
            size="sm"
            onClick={() => setBetAmount(String(amount))}
            disabled={!!activeBet}
            className="font-mono text-xs h-7 px-1"
          >
            {amount}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <Button variant="secondary" size="sm" className="h-7"
          onClick={() => setBetAmount(prev => String(Math.max(1, parseFloat(prev) / 2)))}
          disabled={!!activeBet}>½</Button>
        <Button variant="secondary" size="sm" className="h-7"
          onClick={() => setBetAmount(prev => String(Math.min(balance, parseFloat(prev) * 2)))}
          disabled={!!activeBet}>2×</Button>
      </div>

      {/* Auto-bet controls */}
      <div className="space-y-2 pt-1 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-primary" />
            <Label className="text-xs font-medium cursor-pointer" htmlFor={`auto-${label}`}>Auto Bet</Label>
          </div>
          <Switch
            id={`auto-${label}`}
            checked={autoBet}
            onCheckedChange={setAutoBet}
            className="scale-75"
          />
        </div>
        {autoBet && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Cash at</span>
            <Input
              type="number"
              value={autoCashout}
              onChange={e => setAutoCashout(e.target.value)}
              className="font-mono text-xs bg-muted border-border h-7"
              min={1.01}
              step={0.1}
            />
            <span className="text-xs text-muted-foreground">×</span>
          </div>
        )}
      </div>

      {canCashout ? (
        <Button
          onClick={handleCashout}
          className="w-full h-12 text-base font-bold bg-success hover:bg-success/90 text-success-foreground glow-success"
        >
          <div className="flex flex-col items-center leading-tight">
            <span>CASH OUT</span>
            <span className="text-[10px] font-mono opacity-80">{potentialWin.toFixed(2)} KES</span>
          </div>
        </Button>
      ) : (
        <Button
          onClick={handleBet}
          disabled={!canBet}
          className="w-full h-12 text-base font-bold glow-primary"
        >
          {autoBet
            ? (activeBet ? 'Auto Betting...' : 'Auto Bet ON')
            : activeBet
              ? (cashedOut ? `Won ✓` : 'Active...')
              : 'BET'}
        </Button>
      )}

      {activeBet && (
        <div className="text-center text-xs text-muted-foreground font-mono">
          {activeBet.toFixed(0)} → {potentialWin.toFixed(2)} KES
        </div>
      )}
    </div>
  );
}
