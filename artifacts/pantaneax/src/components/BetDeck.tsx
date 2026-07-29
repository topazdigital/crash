import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GamePhase } from '@/hooks/useGameEngine';
import { Bot, Lock } from 'lucide-react';

interface BetDeckProps {
  label: string;
  phase: GamePhase;
  multiplier: number;
  balance: number;
  isAuthenticated: boolean;
  onBet: (amount: number) => Promise<boolean>;
  onCashout: (multiplier: number) => Promise<void>;
  onLoss: () => Promise<void>;
  onOpenAuth: (mode?: 'sign-in' | 'sign-up') => void;
}

export default function BetDeck({ label, phase, multiplier, balance, isAuthenticated, onBet, onCashout, onLoss, onOpenAuth }: BetDeckProps) {
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

  const handleBet = useCallback(async () => {
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) return;
    if (await onBet(amount)) {
      setActiveBet(amount);
      setCashedOut(false);
    }
  }, [betAmount, onBet]);

  const handleCashout = useCallback(async () => {
    if (activeBet && !cashedOut) {
      await onCashout(multiplier);
      setCashedOut(true);
    }
  }, [activeBet, cashedOut, multiplier, onCashout]);

  // Auto-cashout at target multiplier
  useEffect(() => {
    if (phase === 'running' && activeBet && !cashedOut && autoBetRef.current) {
      const target = autoCashoutRef.current;
      if (multiplier >= target) {
        void onCashout(multiplier);
        setCashedOut(true);
      }
    }
  }, [multiplier, phase, activeBet, cashedOut, onCashout]);

  // Auto-reset on crash
  useEffect(() => {
    if (phase === 'crashed' && activeBet && !cashedOut) {
      void onLoss();
      setActiveBet(null);
    }
  }, [phase, activeBet, cashedOut, onLoss]);

  // Reset after cashout when new round starts
  if (phase === 'waiting' && activeBet && cashedOut) {
    setActiveBet(null);
    setCashedOut(false);
  }

  // Auto-bet: place bet automatically when waiting phase starts
  useEffect(() => {
    if (phase === 'waiting' && autoBetRef.current && !activeBet) {
      const timer = setTimeout(async () => {
        if (autoBetRef.current) {
          const amount = parseFloat(betAmount);
          if (!isNaN(amount) && amount > 0 && amount <= balance) {
            if (await onBet(amount)) {
              setActiveBet(amount);
              setCashedOut(false);
            }
          }
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [phase, autoBet, activeBet, betAmount, balance, onBet]);

  const quickAmounts = [50, 100, 500, 1000];
  const canBet = phase === 'waiting' && !activeBet && !autoBet;
  const canCashout = phase === 'running' && activeBet && !cashedOut;
  const potentialWin = activeBet ? activeBet * multiplier : 0;

  // Guest overlay — watch the game but can't bet
  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 relative overflow-hidden">
        {/* Blurred content behind */}
        <div className="opacity-30 pointer-events-none select-none space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
          </div>
          <div className="h-9 rounded bg-muted" />
          <div className="grid grid-cols-4 gap-1.5">
            {quickAmounts.map(a => (
              <div key={a} className="h-7 rounded bg-muted" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="h-7 rounded bg-muted" />
            <div className="h-7 rounded bg-muted" />
          </div>
          <div className="h-12 rounded bg-muted" />
        </div>

        {/* Lock overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/60 backdrop-blur-sm rounded-xl">
          <Lock className="w-6 h-6 text-primary" />
          <p className="text-sm text-muted-foreground text-center px-4">Sign in to place bets</p>
          <Button size="sm" className="glow-primary font-semibold" onClick={() => onOpenAuth('sign-in')}>
            Sign In / Register
          </Button>
        </div>
      </div>
    );
  }

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
