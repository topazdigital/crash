import { cn } from '@/lib/utils';

interface GameHistoryProps {
  history: number[];
}

export default function GameHistory({ history }: GameHistoryProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {history.map((crash, i) => (
        <span
          key={i}
          className={cn(
            "shrink-0 px-3 py-1 rounded-full text-xs font-mono font-bold",
            crash >= 2 ? "bg-success/20 text-success" :
            crash >= 1.5 ? "bg-primary/20 text-primary" :
            "bg-destructive/20 text-destructive"
          )}
        >
          {crash.toFixed(2)}x
        </span>
      ))}
    </div>
  );
}
