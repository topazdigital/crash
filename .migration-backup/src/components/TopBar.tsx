import { Button } from '@/components/ui/button';
import { User } from '@/hooks/useAuth';
import { Plane, LogOut, Wallet, RefreshCw } from 'lucide-react';

interface TopBarProps {
  user: User | null;
  balance: number;
  mode: 'demo' | 'real';
  onLogout: () => void;
  onResetDemo: () => void;
}

export default function TopBar({ user, balance, mode, onLogout, onResetDemo }: TopBarProps) {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2">
          <Plane className="w-6 h-6 text-primary" />
          <span className="text-lg font-bold tracking-tight">
            pantane<span className="text-primary">Ax</span>
          </span>
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="font-mono text-sm font-bold">{balance.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground">KES</span>
            </div>

            <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-primary/20 text-primary">
              {mode}
            </span>

            {mode === 'demo' && (
              <Button variant="ghost" size="sm" onClick={onResetDemo} title="Reset demo balance">
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}

            <span className="text-sm text-muted-foreground hidden sm:inline">{user.name}</span>

            <Button variant="ghost" size="sm" onClick={onLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
