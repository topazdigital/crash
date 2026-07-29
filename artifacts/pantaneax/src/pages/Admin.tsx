import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { ArrowLeft, BarChart3, ShieldCheck, Users, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Overview {
  users: number;
  bets: number;
  volume: number;
  payouts: number;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  balance: string | null;
  createdAt: string;
}

interface Activity {
  id: string;
  type: string;
  amount: string;
  description: string;
  createdAt: string;
  userName: string;
  userEmail: string;
}

const money = (value: number | string | null) =>
  `${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} KES`;

export default function Admin() {
  const { user, isLoading: authLoading } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role !== "admin") return;
    Promise.all([
      fetch("/api/admin/overview", { credentials: "include" }),
      fetch("/api/admin/users", { credentials: "include" }),
      fetch("/api/admin/activity", { credentials: "include" }),
    ])
      .then(async ([overviewResponse, usersResponse, activityResponse]) => {
        if (!overviewResponse.ok || !usersResponse.ok || !activityResponse.ok) {
          throw new Error("Unable to load administrator data");
        }
        const [overviewData, usersData, activityData] = await Promise.all([
          overviewResponse.json() as Promise<Overview>,
          usersResponse.json() as Promise<{ users: AdminUser[] }>,
          activityResponse.json() as Promise<{ activity: Activity[] }>,
        ]);
        setOverview(overviewData);
        setUsers(usersData.users);
        setActivity(activityData.activity);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Unable to load data");
      });
  }, [user?.role]);

  if (authLoading) {
    return <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">Loading administrator access…</div>;
  }
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 sticky top-0 z-20">
        <div className="container mx-auto h-16 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <div>
              <p className="font-semibold">Administration</p>
              <p className="text-xs text-muted-foreground">PantaneAX operations</p>
            </div>
          </div>
          <Link to="/">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to game
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Live totals from your MySQL database.</p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Registered users" value={overview?.users ?? 0} icon={<Users className="w-5 h-5" />} />
          <MetricCard label="Total bets" value={overview?.bets ?? 0} icon={<BarChart3 className="w-5 h-5" />} />
          <MetricCard label="Bet volume" value={money(overview?.volume ?? 0)} icon={<Wallet className="w-5 h-5" />} />
          <MetricCard label="Payouts" value={money(overview?.payouts ?? 0)} icon={<ShieldCheck className="w-5 h-5" />} />
        </div>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle>Users</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b border-border">
                <tr><th className="py-3 pr-4">Name</th><th className="py-3 pr-4">Email</th><th className="py-3 pr-4">Role</th><th className="py-3 pr-4">Balance</th><th className="py-3">Joined</th></tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id} className="border-b border-border/60 last:border-0">
                    <td className="py-3 pr-4 font-medium">{item.name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{item.email}</td>
                    <td className="py-3 pr-4"><span className="rounded bg-primary/15 text-primary px-2 py-1 text-xs">{item.role}</span></td>
                    <td className="py-3 pr-4 font-mono">{money(item.balance)}</td>
                    <td className="py-3 text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No users have signed in yet.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b border-border">
                <tr><th className="py-3 pr-4">User</th><th className="py-3 pr-4">Activity</th><th className="py-3 pr-4">Amount</th><th className="py-3">Time</th></tr>
              </thead>
              <tbody>
                {activity.map((item) => (
                  <tr key={item.id} className="border-b border-border/60 last:border-0">
                    <td className="py-3 pr-4"><p className="font-medium">{item.userName}</p><p className="text-xs text-muted-foreground">{item.userEmail}</p></td>
                    <td className="py-3 pr-4">{item.description}</td>
                    <td className="py-3 pr-4 font-mono">{money(item.amount)}</td>
                    <td className="py-3 text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {activity.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No account activity yet.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5">
        <div className="flex items-center justify-between text-muted-foreground"><span className="text-sm">{label}</span><span className="text-primary">{icon}</span></div>
        <p className="text-2xl font-bold mt-3">{value}</p>
      </CardContent>
    </Card>
  );
}