import { useCallback, useRef } from 'react';
import { useGameEngine } from '@/hooks/useGameEngine';
import { useWallet } from '@/hooks/useWallet';
import { useAuth } from '@/hooks/useAuth';
import GameChart from '@/components/GameChart';
import BetDeck from '@/components/BetDeck';
import GameHistory from '@/components/GameHistory';
import TopBar from '@/components/TopBar';
import TransactionList from '@/components/TransactionList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Index() {
  const { user, logout, isAuthenticated, isLoading: authLoading } = useAuth();
  const game = useGameEngine();
  const wallet = useWallet(isAuthenticated);
  const lastBet1 = useRef<{ id: string; amount: number } | null>(null);
  const lastBet2 = useRef<{ id: string; amount: number } | null>(null);

  const handleBet1 = useCallback(async (amount: number) => {
    const id = await wallet.placeBet(amount, crypto.randomUUID());
    if (id) lastBet1.current = { id, amount };
    return Boolean(id);
  }, [wallet]);

  const handleBet2 = useCallback(async (amount: number) => {
    const id = await wallet.placeBet(amount, crypto.randomUUID());
    if (id) lastBet2.current = { id, amount };
    return Boolean(id);
  }, [wallet]);

  const handleCashout1 = useCallback(async (multiplier: number) => {
    if (lastBet1.current) {
      await wallet.settleBet(lastBet1.current.id, multiplier, "win");
      lastBet1.current = null;
    }
  }, [wallet]);

  const handleCashout2 = useCallback(async (multiplier: number) => {
    if (lastBet2.current) {
      await wallet.settleBet(lastBet2.current.id, multiplier, "win");
      lastBet2.current = null;
    }
  }, [wallet]);

  const handleLoss1 = useCallback(async () => {
    if (lastBet1.current) {
      await wallet.settleBet(lastBet1.current.id, game.multiplier, "loss");
      lastBet1.current = null;
    }
  }, [game.multiplier, wallet]);

  const handleLoss2 = useCallback(async () => {
    if (lastBet2.current) {
      await wallet.settleBet(lastBet2.current.id, game.multiplier, "loss");
      lastBet2.current = null;
    }
  }, [game.multiplier, wallet]);

  if (authLoading || (isAuthenticated && wallet.loading)) {
    return <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">Loading account…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        user={user}
        balance={wallet.balance}
        onLogout={logout}
      />

      <main className="container mx-auto px-4 py-4 max-w-6xl">
        <div className="mb-4">
          <GameHistory history={game.history} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Bet Deck 1 */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            <BetDeck
              label="Bet 1"
              phase={game.phase}
              multiplier={game.multiplier}
              balance={wallet.balance}
              isAuthenticated={isAuthenticated}
              onBet={handleBet1}
              onCashout={handleCashout1}
              onLoss={handleLoss1}
            />
          </div>

          {/* Game Chart */}
          <div className="lg:col-span-6 order-1 lg:order-2">
            <GameChart
              multiplier={game.multiplier}
              phase={game.phase}
              countdown={game.countdown}
            />
          </div>

          {/* Bet Deck 2 */}
          <div className="lg:col-span-3 order-3">
            <BetDeck
              label="Bet 2"
              phase={game.phase}
              multiplier={game.multiplier}
              balance={wallet.balance}
              isAuthenticated={isAuthenticated}
              onBet={handleBet2}
              onCashout={handleCashout2}
              onLoss={handleLoss2}
            />
          </div>
        </div>

        <div className="mt-6">
          <Tabs defaultValue="history" className="w-full">
            <TabsList className="bg-muted">
              <TabsTrigger value="history">My Bets</TabsTrigger>
              <TabsTrigger value="all">All Bets</TabsTrigger>
            </TabsList>
            <TabsContent value="history" className="mt-4">
              <TransactionList transactions={wallet.transactions} />
            </TabsContent>
            <TabsContent value="all" className="mt-4">
              <div className="text-center py-8 text-muted-foreground text-sm">Live activity is available to authenticated players.</div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
