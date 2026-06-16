"use client";

import { useMemo, useState } from "react";
import { Award, Loader2, Plus, Trash2 } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function AccountRewardsPanel({ account }: { account: CreditAccountOption }) {
  const endpoint = `/api/accounts/${account.id}/redemptions`;
  const { data, isLoading, mutate } = useSWR<RedemptionsResponse>(endpoint, fetcher);

  const [redeemOpen, setRedeemOpen] = useState(false);
  const [points, setPoints] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<RewardRedemptionItem | null>(null);

  const balance = data?.pointsBalance ?? 0;

  const sortedRedemptions = useMemo(() => {
    const redemptions = data?.redemptions ?? [];
    return [...redemptions].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
  }, [data?.redemptions]);

  function openRedeem() {
    setPoints("");
    setDescription("");
    setDate(today());
    setRedeemOpen(true);
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(points);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Points must be greater than 0");
      return;
    }
    if (amt > balance) {
      toast.error(`Cannot redeem more than the current balance (${formatPoints(balance)} pts)`);
      return;
    }
    if (!date) {
      toast.error("Date is required");
      return;
    }

    setSaving(true);
    try {
      await apiFetch(endpoint, {
        method: "POST",
        body: {
          points: amt,
          description: description.trim() || undefined,
          date,
        },
      });
      toast.success("Points redeemed");
      setRedeemOpen(false);
      mutate();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message || "Failed to redeem points");
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to redeem points");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await apiFetch(`/api/redemptions/${deleting.id}`, { method: "DELETE" });
      toast.success("Redemption deleted");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete redemption");
    }
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Points balance</p>
              <p className="text-3xl font-semibold tabular-nums">
                {isLoading ? "—" : formatPoints(balance)}
                <span className="ml-1 text-base font-normal text-muted-foreground">pts</span>
              </p>
            </div>
            <div className="rounded-full bg-muted p-3 text-primary">
              <Award className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Redemption history</CardTitle>
            <CardDescription>{account.name}</CardDescription>
          </div>
          <Button onClick={openRedeem}>
            <Plus className="size-4" />
            Redeem points
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : sortedRedemptions.length === 0 ? (
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
                {sortedRedemptions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.date)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.description || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      −{formatPoints(Number(r.points))}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setDeleting(r)}
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
        </CardContent>
      </Card>

      <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
        <DialogContent>
          <form onSubmit={handleRedeem}>
            <DialogHeader>
              <DialogTitle>Redeem points</DialogTitle>
              <DialogDescription>
                Record a redemption against {account.name}. Current balance:{" "}
                {formatPoints(balance)} pts.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="redeem-points">Points</Label>
                <Input
                  id="redeem-points"
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
                <Label htmlFor="redeem-date">Date</Label>
                <Input
                  id="redeem-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="redeem-description">Description</Label>
                <Textarea
                  id="redeem-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional, e.g. Redeemed for flight voucher"
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRedeemOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Redeem
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete redemption?"
        description="This will add the points back to the account's balance."
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
