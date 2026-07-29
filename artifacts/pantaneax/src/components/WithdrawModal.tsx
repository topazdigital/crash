import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowUpFromLine, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WithdrawModalProps {
  open: boolean;
  balance: number;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

const QUICK_AMOUNTS = [100, 500, 1000, 2000];

type Step = 'form' | 'processing' | 'done';

export default function WithdrawModal({ open, balance, onClose, onSuccess }: WithdrawModalProps) {
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [newBalance, setNewBalance] = useState(0);
  const { toast } = useToast();

  const reset = () => {
    setAmount('');
    setPhone('');
    setStep('form');
  };

  const handleWithdraw = async () => {
    const num = Number(amount);
    if (!num || num <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' });
      return;
    }
    if (num > balance) {
      toast({ title: 'Insufficient balance', variant: 'destructive' });
      return;
    }
    const trimPhone = phone.trim();
    if (!trimPhone) {
      toast({ title: 'Enter your M-PESA phone number', variant: 'destructive' });
      return;
    }

    setStep('processing');

    try {
      const res = await fetch('/api/wallet/withdrawals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: num, phone: trimPhone, method: 'mpesa' }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? 'Withdrawal failed');
      }

      const data = await res.json() as { balance: string };
      const nb = Number(data.balance);
      setNewBalance(nb);
      setStep('done');
      onSuccess(nb);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Withdrawal failed';
      toast({ title: msg, variant: 'destructive' });
      setStep('form');
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpFromLine className="w-5 h-5 text-primary" />
            Withdraw via M-PESA
          </DialogTitle>
          {step === 'form' && (
            <DialogDescription>
              Available balance: <span className="font-semibold text-foreground">{balance.toFixed(2)} KES</span>
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4 pt-2">
            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-2">
              {QUICK_AMOUNTS.filter(q => q <= balance).map((q) => (
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

            <div className="relative">
              <Input
                type="number"
                min="1"
                max={balance}
                placeholder="Amount (KES)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-muted border-border pr-14"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">KES</span>
            </div>

            <Input
              type="tel"
              placeholder="M-PESA number e.g. 07XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-muted border-border"
              onKeyDown={(e) => e.key === 'Enter' && handleWithdraw()}
            />

            <Button
              className="w-full font-semibold"
              variant="outline"
              disabled={!amount || Number(amount) <= 0 || Number(amount) > balance || !phone.trim()}
              onClick={handleWithdraw}
            >
              Withdraw {amount ? Number(amount).toFixed(2) : '0.00'} KES
            </Button>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <div>
              <p className="font-semibold">Processing withdrawal…</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your M-PESA payment will arrive shortly.
              </p>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <div>
              <p className="font-semibold text-lg">Withdrawal submitted!</p>
              <p className="text-sm text-muted-foreground mt-1">
                New balance: <span className="font-bold text-foreground">{newBalance.toFixed(2)} KES</span>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Funds will be sent to your M-PESA shortly.
              </p>
            </div>
            <Button className="w-full" onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
