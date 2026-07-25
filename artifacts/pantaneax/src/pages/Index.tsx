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
  const { user, logout, isAuthenticated } = useAuth();
  const game = useGameEngine();
  const wallet = useWallet();
  const lastBet1 = useRef(0);
  const lastBet2 = useRef(0);

  const handleBet1 = useCallback((amount: number) => {
    const ok = wallet.placeBet(amount);
    if (ok) lastBet1.current = amount;
    return ok;
  }, [wallet]);

  const handleBet2 = useCallback((amount: number) => {
    const ok = wallet.placeBet(amount);
    if (ok) lastBet2.current = amount;
    return ok;
  }, [wallet]);

  const handleCashout1 = useCallback((multiplier: number) => {
    wallet.creditWin(lastBet1.current * multiplier, multiplier);
  }, [wallet]);

  const handleCashout2 = useCallback((multiplier: number) => {
    wallet.creditWin(lastBet2.current * multiplier, multiplier);
  }, [wallet]);

  const handleLoss1 = useCallback(() => {
    wallet.recordLoss(lastBet1.current);
  }, [wallet]);

  const handleLoss2 = useCallback(() => {
    wallet.recordLoss(lastBet2.current);
  }, [wallet]);

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        user={user}
        balance={wallet.balance}
        mode={wallet.mode}
        onLogout={logout}
        onResetDemo={wallet.resetDemo}
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
              <div className="text-center py-8 text-muted-foreground text-sm">
                Multiplayer bets will appear here
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
