import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000];

export default function DepositModal({ open, onClose, onSuccess }: DepositModalProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDeposit = async () => {
    const num = Number(amount);
    if (!num || num <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      // Create deposit
      const createRes = await fetch('/api/wallet/deposits', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: num, method: 'manual' }),
      });
      if (!createRes.ok) throw new Error('Failed to create deposit');
      const { depositId } = (await createRes.json()) as { depositId: string };

      // Immediately confirm (manual deposit — no payment provider needed)
      const confirmRes = await fetch(`/api/wallet/deposits/${depositId}/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!confirmRes.ok) throw new Error('Failed to confirm deposit');
      const { balance } = (await confirmRes.json()) as { balance: string };

      toast({ title: `Deposited ${num.toFixed(2)} KES`, description: `New balance: ${Number(balance).toFixed(2)} KES` });
      onSuccess(Number(balance));
      setAmount('');
      onClose();
    } catch {
      toast({ title: 'Deposit failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Deposit Funds
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Quick amounts */}
          <div className="grid grid-cols-5 gap-2">
            {QUICK_AMOUNTS.map((q) => (
              <Button
                key={q}
                variant={amount === String(q) ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => setAmount(String(q))}
              >
                {q}
              </Button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="relative">
            <Input
              type="number"
              min="1"
              placeholder="Enter amount (KES)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-muted border-border pr-14"
              onKeyDown={(e) => e.key === 'Enter' && handleDeposit()}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">KES</span>
          </div>

          <Button
            className="w-full glow-primary font-semibold"
            disabled={loading || !amount || Number(amount) <= 0}
            onClick={handleDeposit}
          >
            {loading ? 'Processing…' : `Deposit ${amount ? Number(amount).toFixed(2) : '0.00'} KES`}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Funds are added instantly to your balance.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
