import { Transaction } from '@/hooks/useWallet';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
}

export default function TransactionList({ transactions }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No transactions yet. Place your first bet!
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {transactions.slice(0, 20).map(tx => {
        const isPositive = tx.type === 'win' || tx.type === 'deposit';
        return (
          <div key={tx.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center",
                isPositive ? "bg-success/20" : "bg-destructive/20"
              )}>
                {isPositive ? (
                  <ArrowUpRight className="w-3 h-3 text-success" />
                ) : tx.type === 'loss' ? (
                  <Minus className="w-3 h-3 text-destructive" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-destructive" />
                )}
              </div>
              <span className="text-xs text-muted-foreground">{tx.description}</span>
            </div>
            <span className={cn(
              "font-mono text-xs font-bold",
              isPositive ? "text-success" : "text-destructive"
            )}>
              {isPositive ? '+' : '-'}{tx.amount.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
