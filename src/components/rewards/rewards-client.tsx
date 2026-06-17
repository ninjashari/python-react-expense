"use client";

import { useState } from "react";
import { Award, Clock, Gift, Loader2, Plus, Trash2 } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { apiFetch, ApiError } from "@/lib/client";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type CreditAccountOption = {
  id: string;
  name: string;
  currency: string;
};

export type RewardRedemptionItem = {
  id: string;
  accountId: string;
  points: string;
  description: string | null;
  date: string;
  createdAt: string;
};

type RedemptionsResponse = {
  pointsBalance: number;
  redemptions: RewardRedemptionItem[];
};

export type RewardBonusItem = {
  id: string;
  accountId: string;
  points: string;
  description: string | null;
  date: string;
  createdAt: string;
};

type BonusesResponse = {
  pointsBalance: number;
  bonuses: RewardBonusItem[];
};

type HistoryKind = "earned" | "bonus" | "redeemed";

export type RewardHistoryItem = {
  id: string;
  kind: HistoryKind;
  points: number;
  description: string | null;
  date: string;
  createdAt: string;
  balance: number;
};

type HistoryResponse = {
  pointsBalance: number;
  history: RewardHistoryItem[];
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatPoints(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}

type Props = {
  accounts: CreditAccountOption[];
};

export function RewardsClient({ accounts }: Props) {
  const [selectedId, setSelectedId] = useState(accounts[0]?.id ?? "");

  if (accounts.length === 0) {
    return (
      <div>
        <PageHeader title="Reward points" description="Track and redeem credit card reward points." />
        <EmptyState
          icon={Award}
          title="No credit card accounts yet"
          description="Add a credit account to start tracking reward points."
        />
      </div>
    );
  }

  const selectedAccount = accounts.find((a) => a.id === selectedId) ?? accounts[0];

  return (
    <div>
      <PageHeader title="Reward points" description="Track and redeem credit card reward points." />

      {accounts.length > 1 && (
        <Tabs value={selectedAccount.id} onValueChange={setSelectedId} className="mb-4">
          <TabsList>
            {accounts.map((a) => (
              <TabsTrigger key={a.id} value={a.id}>
                {a.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <AccountRewardsPanel account={selectedAccount} />
    </div>
  );
}

const KIND_META: Record<HistoryKind, { label: string; className: string }> = {
  earned: { label: "Earned", className: "text-emerald-600 dark:text-emerald-400" },
  bonus: { label: "Bonus", className: "text-sky-600 dark:text-sky-400" },
  redeemed: { label: "Redeemed", className: "text-rose-600 dark:text-rose-400" },
};

type DialogMode = "redeem" | "bonus";

function AccountRewardsPanel({ account }: { account: CreditAccountOption }) {
  const redemptionsKey = `/api/accounts/${account.id}/redemptions`;
  const bonusesKey = `/api/accounts/${account.id}/bonuses`;
  const historyKey = `/api/accounts/${account.id}/reward-history`;

  const redemptionsSwr = useSWR<RedemptionsResponse>(redemptionsKey, fetcher);
  const bonusesSwr = useSWR<BonusesResponse>(bonusesKey, fetcher);
  const historySwr = useSWR<HistoryResponse>(historyKey, fetcher);

  function refreshAll() {
    redemptionsSwr.mutate();
    bonusesSwr.mutate();
    historySwr.mutate();
  }

  const [mode, setMode] = useState<DialogMode | null>(null);
  const [points, setPoints] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);

  const [deletingRedemption, setDeletingRedemption] = useState<RewardRedemptionItem | null>(null);
  const [deletingBonus, setDeletingBonus] = useState<RewardBonusItem | null>(null);

  const balance = historySwr.data?.pointsBalance ?? redemptionsSwr.data?.pointsBalance ?? 0;
  const isLoading = historySwr.isLoading;

  const redemptions = redemptionsSwr.data?.redemptions ?? [];
  const bonuses = bonusesSwr.data?.bonuses ?? [];
  const history = historySwr.data?.history ?? [];

  function openDialog(next: DialogMode) {
    setPoints("");
    setDescription("");
    setDate(today());
    setMode(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(points);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Points must be greater than 0");
      return;
    }
    if (mode === "redeem" && amt > balance) {
      toast.error(`Cannot redeem more than the current balance (${formatPoints(balance)} pts)`);
      return;
    }
    if (!date) {
      toast.error("Date is required");
      return;
    }

    setSaving(true);
    try {
      await apiFetch(mode === "bonus" ? bonusesKey : redemptionsKey, {
        method: "POST",
        body: { points: amt, description: description.trim() || undefined, date },
      });
      toast.success(mode === "bonus" ? "Bonus added" : "Points redeemed");
      setMode(null);
      refreshAll();
    } catch (err) {
      const fallback = mode === "bonus" ? "Failed to add bonus" : "Failed to redeem points";
      if (err instanceof ApiError) {
        toast.error(err.message || fallback);
      } else {
        toast.error(err instanceof Error ? err.message : fallback);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRedemption() {
    if (!deletingRedemption) return;
    try {
      await apiFetch(`/api/redemptions/${deletingRedemption.id}`, { method: "DELETE" });
      toast.success("Redemption deleted");
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete redemption");
    }
  }

  async function handleDeleteBonus() {
    if (!deletingBonus) return;
    try {
      await apiFetch(`/api/bonuses/${deletingBonus.id}`, { method: "DELETE" });
      toast.success("Bonus deleted");
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete bonus");
    }
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="group relative overflow-hidden transition-shadow hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-600" />
          <CardContent className="flex items-center justify-between p-5 pt-6">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Points balance</p>
              <p className="text-3xl font-bold tabular-nums">
                {isLoading ? "—" : formatPoints(balance)}
                <span className="ml-1 text-base font-normal text-muted-foreground">pts</span>
              </p>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-3 text-amber-600 transition-transform duration-200 group-hover:scale-110 dark:bg-amber-400/15 dark:text-amber-400">
              <Award className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Reward points</CardTitle>
            <CardDescription>{account.name}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => openDialog("bonus")}>
              <Gift className="size-4" />
              Add bonus
            </Button>
            <Button onClick={() => openDialog("redeem")}>
              <Plus className="size-4" />
              Redeem points
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="history">
            <TabsList>
              <TabsTrigger value="history">
                <Clock className="size-4" />
                History
              </TabsTrigger>
              <TabsTrigger value="redemptions">Redemptions</TabsTrigger>
              <TabsTrigger value="bonuses">Bonuses</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-4">
              {isLoading ? (
                <PanelLoading />
              ) : history.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="No activity yet"
                  description="Earned points, bonuses and redemptions appear here as a running ledger."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h) => {
                      const meta = KIND_META[h.kind];
                      return (
                        <TableRow key={h.id}>
                          <TableCell className="whitespace-nowrap">{formatDate(h.date)}</TableCell>
                          <TableCell>
                            <span className={`text-sm font-medium ${meta.className}`}>
                              {meta.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {h.description || "—"}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums font-medium ${meta.className}`}
                          >
                            {h.points >= 0 ? "+" : "−"}
                            {formatPoints(Math.abs(h.points))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatPoints(h.balance)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="redemptions" className="mt-4">
              {redemptionsSwr.isLoading ? (
                <PanelLoading />
              ) : redemptions.length === 0 ? (
                <EmptyState
                  icon={Award}
                  title="No redemptions yet"
                  description="Redeem points to see them listed here."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {redemptions.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{formatDate(r.date)}</TableCell>
                        <TableCell className="text-muted-foreground">{r.description || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-rose-600 dark:text-rose-400">
                          −{formatPoints(Number(r.points))}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => setDeletingRedemption(r)}
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="bonuses" className="mt-4">
              {bonusesSwr.isLoading ? (
                <PanelLoading />
              ) : bonuses.length === 0 ? (
                <EmptyState
                  icon={Gift}
                  title="No bonuses yet"
                  description="Add a bonus to record points earned outside transactions (sign-up, milestones, etc.)."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bonuses.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>{formatDate(b.date)}</TableCell>
                        <TableCell className="text-muted-foreground">{b.description || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-sky-600 dark:text-sky-400">
                          +{formatPoints(Number(b.points))}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => setDeletingBonus(b)}
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{mode === "bonus" ? "Add bonus points" : "Redeem points"}</DialogTitle>
              <DialogDescription>
                {mode === "bonus"
                  ? `Record bonus points earned on ${account.name} outside of transactions.`
                  : `Record a redemption against ${account.name}. Current balance: ${formatPoints(balance)} pts.`}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="reward-points">Points</Label>
                <Input
                  id="reward-points"
                  type="number"
                  min="0"
                  step="0.01"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="0"
                  required
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reward-date">Date</Label>
                <Input
                  id="reward-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reward-description">Description</Label>
                <Textarea
                  id="reward-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    mode === "bonus"
                      ? "Optional, e.g. Sign-up bonus"
                      : "Optional, e.g. Redeemed for flight voucher"
                  }
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMode(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {mode === "bonus" ? "Add bonus" : "Redeem"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deletingRedemption !== null}
        onOpenChange={(open) => !open && setDeletingRedemption(null)}
        title="Delete redemption?"
        description="This will add the points back to the account's balance."
        confirmLabel="Delete"
        onConfirm={handleDeleteRedemption}
      />

      <ConfirmDialog
        open={deletingBonus !== null}
        onOpenChange={(open) => !open && setDeletingBonus(null)}
        title="Delete bonus?"
        description="This will remove the bonus points from the account's balance."
        confirmLabel="Delete"
        onConfirm={handleDeleteBonus}
      />
    </div>
  );
}

function PanelLoading() {
  return (
    <div className="flex h-32 items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}
