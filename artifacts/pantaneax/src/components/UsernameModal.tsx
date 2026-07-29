import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UsernameModalProps {
  open: boolean;
  onDone: (name: string) => void;
}

export default function UsernameModal({ open, onDone }: UsernameModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      toast({ title: 'Username must be at least 2 characters', variant: 'destructive' });
      return;
    }
    if (trimmed.length > 30) {
      toast({ title: 'Username must be 30 characters or less', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/me/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error('Failed to save username');
      onDone(trimmed);
    } catch {
      toast({ title: 'Could not save username', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-sm bg-card border-border"
        // prevent closing by clicking outside or pressing Escape
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Choose your username
          </DialogTitle>
          <DialogDescription>
            Pick a display name that other players will see. You can change it later in your profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <Input
            placeholder="e.g. LuckyAce"
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-muted border-border"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />

          <Button
            className="w-full glow-primary font-semibold"
            disabled={loading || name.trim().length < 2}
            onClick={handleSave}
          >
            {loading ? 'Saving…' : 'Set username & continue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
