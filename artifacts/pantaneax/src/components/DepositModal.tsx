import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Loader2, Smartphone, Wallet, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000];

type Step = 'form' | 'waiting' | 'success' | 'failed';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000; // 2 minutes

export default function DepositModal({ open, onClose, onSuccess }: DepositModalProps) {
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [depositId, setDepositId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  const reset = () => {
    stopPolling();
    setAmount('');
    setPhone('');
    setStep('form');
    setDepositId(null);
    setLoading(false);
  };

  // Start polling once we have a depositId in waiting state
  useEffect(() => {
    if (step !== 'waiting' || !depositId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/wallet/deposits/${depositId}/status`, { credentials: 'include' });
        if (!res.ok) return;
        const { status } = await res.json() as { status: string };

        if (status === 'completed') {
          stopPolling();
          setStep('success');
          // Refresh wallet balance
          const me = await fetch('/api/me', { credentials: 'include' });
          if (me.ok) {
            const data = await me.json() as { wallet: { balance: string } };
            onSuccess(Number(data.wallet.balance));
          }
        } else if (status === 'failed') {
          stopPolling();
          setStep('failed');
        }
      } catch {
        // network error — keep polling
      }
    };

    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    // Stop after 2 minutes and show failure
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setStep('failed');
    }, POLL_TIMEOUT_MS);

    return stopPolling;
  }, [step, depositId]);

  // Cleanup on modal close
  useEffect(() => {
    if (!open) { stopPolling(); }
  }, [open]);

  const handleDeposit = async () => {
    const num = Number(amount);
    if (!num || num <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' });
      return;
    }
    const trimPhone = phone.trim();
    if (!trimPhone) {
      toast({ title: 'Enter your M-PESA phone number', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/wallet/deposits', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: num, phone: trimPhone }),
      });

      const data = await res.json() as { depositId?: string; error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to initiate deposit');

      setDepositId(data.depositId!);
      setStep('waiting');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deposit failed';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
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
            <Wallet className="w-5 h-5 text-primary" />
            {step === 'waiting' ? 'Waiting for payment…' : step === 'success' ? 'Deposit confirmed!' : step === 'failed' ? 'Payment not received' : 'Deposit via M-PESA'}
          </DialogTitle>
        </DialogHeader>

        {/* ── Form ── */}
        {step === 'form' && (
          <div className="space-y-4 pt-2">
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

            <div className="relative">
              <Input
                type="number"
                min="1"
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
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleDeposit()}
            />

            <Button
              className="w-full glow-primary font-semibold"
              disabled={loading || !amount || Number(amount) <= 0 || !phone.trim()}
              onClick={handleDeposit}
            >
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending prompt…</> : `Deposit ${amount ? Number(amount).toFixed(2) : '0.00'} KES`}
            </Button>
          </div>
        )}

        {/* ── Waiting for M-PESA PIN ── */}
        {step === 'waiting' && (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <Smartphone className="w-12 h-12 text-primary" />
              <Loader2 className="w-5 h-5 text-primary animate-spin absolute -bottom-1 -right-1" />
            </div>
            <div>
              <p className="font-semibold">Check your phone</p>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your <span className="font-semibold text-foreground">M-PESA PIN</span> to complete the deposit.
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                This page will update automatically once payment is confirmed.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose} className="text-muted-foreground">
              Cancel
            </Button>
          </div>
        )}

        {/* ── Success ── */}
        {step === 'success' && (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <div>
              <p className="font-semibold text-lg">Payment confirmed!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {amount ? `${Number(amount).toFixed(2)} KES` : 'Funds'} have been added to your balance.
              </p>
            </div>
            <Button className="w-full glow-primary font-semibold" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}

        {/* ── Failed ── */}
        {step === 'failed' && (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <XCircle className="w-12 h-12 text-destructive" />
            <div>
              <p className="font-semibold text-lg">Payment not received</p>
              <p className="text-sm text-muted-foreground mt-1">
                The M-PESA prompt may have expired or been declined. No funds were deducted.
              </p>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
              <Button className="flex-1 glow-primary font-semibold" onClick={() => { stopPolling(); setStep('form'); }}>Try again</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
