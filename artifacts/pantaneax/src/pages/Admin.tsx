import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpFromLine,
  BarChart3,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface Overview {
  users: number;
  bets: number;
  volume: number;
  payouts: number;
  deposited: number;
  withdrawn: number;
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

interface AdminDeposit {
  id: string;
  amount: string;
  status: string;
  method: string;
  phone: string | null;
  providerRef: string | null;
  createdAt: string;
  completedAt: string | null;
  userName: string;
  userEmail: string;
}

interface AdminWithdrawal {
  id: string;
  amount: string;
  status: string;
  method: string;
  phone: string | null;
  providerRef: string | null;
  createdAt: string;
  processedAt: string | null;
  userName: string;
  userEmail: string;
}

const money = (value: number | string | null) =>
  `${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} KES`;

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-500/15 text-green-400 border-green-500/20",
  pending:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  failed:    "bg-red-500/15 text-red-400 border-red-500/20",
  cancelled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  processing:"bg-blue-500/15 text-blue-400 border-blue-500/20",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

export default function Admin() {
  const { user, isLoading: authLoading } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [deposits, setDeposits] = useState<AdminDeposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [error, setError] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);

  function loadData() {
    return Promise.all([
      fetch("/api/admin/overview",    { credentials: "include" }),
      fetch("/api/admin/users",       { credentials: "include" }),
      fetch("/api/admin/activity",    { credentials: "include" }),
      fetch("/api/admin/deposits",    { credentials: "include" }),
      fetch("/api/admin/withdrawals", { credentials: "include" }),
    ])
      .then(async ([ovRes, usRes, acRes, depRes, wdRes]) => {
        if (!ovRes.ok || !usRes.ok || !acRes.ok || !depRes.ok || !wdRes.ok) {
          throw new Error("Unable to load administrator data");
        }
        const [ovData, usData, acData, depData, wdData] = await Promise.all([
          ovRes.json()  as Promise<Overview>,
          usRes.json()  as Promise<{ users: AdminUser[] }>,
          acRes.json()  as Promise<{ activity: Activity[] }>,
          depRes.json() as Promise<{ deposits: AdminDeposit[] }>,
          wdRes.json()  as Promise<{ withdrawals: AdminWithdrawal[] }>,
        ]);
        setOverview(ovData);
        setUsers(usData.users);
        setActivity(acData.activity);
        setDeposits(depData.deposits);
        setWithdrawals(wdData.withdrawals);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Unable to load data");
      });
  }

  useEffect(() => {
    if (user?.role !== "admin") return;
    loadData();
  }, [user?.role]);

  async function approveDeposit(depositId: string) {
    setApprovingId(depositId);
    try {
      const res = await fetch(`/api/admin/deposits/${depositId}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Failed to approve deposit");
        return;
      }
      // Reload data to reflect new status and balance
      await loadData();
    } catch {
      setError("Network error while approving deposit");
    } finally {
      setApprovingId(null);
    }
  }

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

        {/* ── Metric cards ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Registered users"   value={overview?.users ?? 0}              icon={<Users className="w-5 h-5" />} />
          <MetricCard label="Total bets"          value={overview?.bets ?? 0}               icon={<BarChart3 className="w-5 h-5" />} />
          <MetricCard label="Bet volume"          value={money(overview?.volume ?? 0)}      icon={<BarChart3 className="w-5 h-5" />} />
          <MetricCard label="Payouts"             value={money(overview?.payouts ?? 0)}     icon={<ShieldCheck className="w-5 h-5" />} />
          <MetricCard label="Total deposited"     value={money(overview?.deposited ?? 0)}   icon={<Wallet className="w-5 h-5" />} highlight />
          <MetricCard label="Total withdrawn"     value={money(overview?.withdrawn ?? 0)}   icon={<ArrowUpFromLine className="w-5 h-5" />} />
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="bg-muted">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="deposits">
              Deposits
              {deposits.filter(d => d.status === "pending").length > 0 && (
                <Badge className="ml-2 bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs px-1.5 py-0">
                  {deposits.filter(d => d.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="withdrawals">
              Withdrawals
              {withdrawals.filter(w => w.status === "pending").length > 0 && (
                <Badge className="ml-2 bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs px-1.5 py-0">
                  {withdrawals.filter(w => w.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* Users */}
          <TabsContent value="users" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader><CardTitle>Users ({users.length})</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-3 pr-4">Name</th>
                      <th className="py-3 pr-4">Email</th>
                      <th className="py-3 pr-4">Role</th>
                      <th className="py-3 pr-4">Balance</th>
                      <th className="py-3">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-border/60 last:border-0">
                        <td className="py-3 pr-4 font-medium">{u.name}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{u.email}</td>
                        <td className="py-3 pr-4">
                          <span className="rounded bg-primary/15 text-primary px-2 py-1 text-xs">{u.role}</span>
                        </td>
                        <td className="py-3 pr-4 font-mono">{money(u.balance)}</td>
                        <td className="py-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No users have signed in yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deposits */}
          <TabsContent value="deposits" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader><CardTitle>Deposits ({deposits.length})</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-3 pr-4">User</th>
                      <th className="py-3 pr-4">Amount</th>
                      <th className="py-3 pr-4">Phone</th>
                      <th className="py-3 pr-4">M-PESA Ref</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Date</th>
                      <th className="py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.map((d) => (
                      <tr key={d.id} className="border-b border-border/60 last:border-0">
                        <td className="py-3 pr-4">
                          <p className="font-medium">{d.userName}</p>
                          <p className="text-xs text-muted-foreground">{d.userEmail}</p>
                        </td>
                        <td className="py-3 pr-4 font-mono font-semibold">{money(d.amount)}</td>
                        <td className="py-3 pr-4 font-mono text-muted-foreground">{d.phone ?? "—"}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{d.providerRef ?? "—"}</td>
                        <td className="py-3 pr-4"><StatusBadge status={d.status} /></td>
                        <td className="py-3 pr-4 text-muted-foreground text-xs">{new Date(d.createdAt).toLocaleString()}</td>
                        <td className="py-3">
                          {d.status === "pending" ? (
                            <button
                              onClick={() => approveDeposit(d.id)}
                              disabled={approvingId === d.id}
                              className="inline-flex items-center gap-1.5 rounded bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 transition-colors"
                            >
                              {approvingId === d.id ? "Approving…" : "✓ Approve"}
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {deposits.length === 0 && (
                      <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No deposits yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawals */}
          <TabsContent value="withdrawals" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader><CardTitle>Withdrawals ({withdrawals.length})</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-3 pr-4">User</th>
                      <th className="py-3 pr-4">Amount</th>
                      <th className="py-3 pr-4">Phone</th>
                      <th className="py-3 pr-4">M-PESA Ref</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="border-b border-border/60 last:border-0">
                        <td className="py-3 pr-4">
                          <p className="font-medium">{w.userName}</p>
                          <p className="text-xs text-muted-foreground">{w.userEmail}</p>
                        </td>
                        <td className="py-3 pr-4 font-mono font-semibold">{money(w.amount)}</td>
                        <td className="py-3 pr-4 font-mono text-muted-foreground">{w.phone ?? "—"}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{w.providerRef ?? "—"}</td>
                        <td className="py-3 pr-4"><StatusBadge status={w.status} /></td>
                        <td className="py-3 text-muted-foreground text-xs">{new Date(w.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                    {withdrawals.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No withdrawals yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity */}
          <TabsContent value="activity" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-3 pr-4">User</th>
                      <th className="py-3 pr-4">Activity</th>
                      <th className="py-3 pr-4">Amount</th>
                      <th className="py-3">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((item) => (
                      <tr key={item.id} className="border-b border-border/60 last:border-0">
                        <td className="py-3 pr-4">
                          <p className="font-medium">{item.userName}</p>
                          <p className="text-xs text-muted-foreground">{item.userEmail}</p>
                        </td>
                        <td className="py-3 pr-4">{item.description}</td>
                        <td className="py-3 pr-4 font-mono">{money(item.amount)}</td>
                        <td className="py-3 text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                    {activity.length === 0 && (
                      <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No account activity yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={`border-border ${highlight ? "bg-primary/10 border-primary/30" : "bg-card"}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-sm">{label}</span>
          <span className={highlight ? "text-primary" : "text-primary"}>{icon}</span>
        </div>
        <p className="text-2xl font-bold mt-3">{value}</p>
      </CardContent>
    </Card>
  );
}
