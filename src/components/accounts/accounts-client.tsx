"use client";

import { useState } from "react";
import useSWR from "swr";
import { MoreHorizontal, Plus, RefreshCw, Wallet } from "lucide-react";
import { fetcher } from "@/lib/swr";
import { apiFetch } from "@/lib/client";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccountForm } from "./account-form";

export type AccountType =
  | "checking"
  | "savings"
  | "credit"
  | "cash"
  | "investment"
  | "ppf";
export type AccountStatus = "active" | "inactive" | "closed";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: string;
  balance: string;
  accountNumber: string | null;
  cardNumber: string | null;
  cardExpiryMonth: number | null;
  cardExpiryYear: number | null;
  creditLimit: string | null;
  billGenerationDate: number | null;
  paymentDueDate: number | null;
  interestRate: string | null;
  status: AccountStatus;
  openingDate: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

const STATUS_VARIANT: Record<AccountStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  inactive: "secondary",
  closed: "outline",
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function AccountsClient() {
  const { data, isLoading, mutate } = useSWR<Account[]>("/api/accounts", fetcher);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const accounts = data ?? [];
  const totalBalance = accounts
    .filter((a) => a.status === "active")
    .reduce((sum, a) => sum + Number(a.balance), 0);

  async function handleRecalculate() {
    setRecalculating(true);
    try {
      const res = await apiFetch<{ recalculated: number }>("/api/accounts/recalculate", {
        method: "POST",
      });
      toast.success(`Recalculated ${res.recalculated} account(s)`);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to recalculate");
    } finally {
      setRecalculating(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await apiFetch(`/api/accounts/${deleting.id}`, { method: "DELETE" });
      toast.success("Account deleted");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
    }
  }

  return (
    <div>
      <PageHeader title="Accounts" description="Manage your accounts and balances.">
        <Button
          variant="outline"
          onClick={handleRecalculate}
          disabled={recalculating}
        >
          <RefreshCw className={cn("size-4", recalculating && "animate-spin")} />
          Recalculate balances
        </Button>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              Add account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add account</DialogTitle>
              <DialogDescription>Create a new account to track.</DialogDescription>
            </DialogHeader>
            <AccountForm
              onSaved={() => {
                setCreateOpen(false);
                mutate();
              }}
            />
          </DialogContent>
        </Dialog>
      </PageHeader>

      {!isLoading && accounts.length > 0 && (
        <Card className="group relative mb-6 overflow-hidden transition-shadow hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-600" />
          <CardContent className="flex items-center justify-between p-5 pt-6">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total balance (active)</p>
              <p className="text-2xl font-bold tabular-nums">
                {formatCurrency(totalBalance)}
              </p>
            </div>
            <div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-400">
              <Wallet className="size-5" />
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-2 h-4 w-20" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Add your first account to start tracking balances."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Add account
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              onEdit={() => setEditing(a)}
              onDelete={() => setDeleting(a)}
            />
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit account</DialogTitle>
            <DialogDescription>Update this account&apos;s details.</DialogDescription>
          </DialogHeader>
          {editing && (
            <AccountForm
              account={editing}
              onSaved={() => {
                setEditing(null);
                mutate();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete account?"
        description={
          deleting
            ? `This will permanently delete "${deleting.name}" and all its transactions.`
            : undefined
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}

function AccountCard({
  account,
  onEdit,
  onDelete,
}: {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const balance = Number(account.balance);
  const isCredit = account.type === "credit";
  const creditLimit = account.creditLimit != null ? Number(account.creditLimit) : null;
  const utilization =
    isCredit && creditLimit && creditLimit > 0
      ? Math.min(100, (Math.abs(balance) / creditLimit) * 100)
      : null;
  const hasInterest = account.type === "ppf" || account.type === "investment";
  const interestRate = account.interestRate != null ? Number(account.interestRate) : null;

  const gradientMap: Record<string, string> = {
    checking: "from-blue-500 to-indigo-600",
    savings: "from-emerald-500 to-teal-600",
    credit: "from-purple-500 to-pink-600",
    cash: "from-amber-500 to-orange-600",
    investment: "from-cyan-500 to-blue-600",
    ppf: "from-teal-500 to-green-600",
  };

  return (
    <Card className="group overflow-hidden transition-shadow duration-200 hover:shadow-md">
      <div className={cn("h-1 bg-gradient-to-r", gradientMap[account.type] ?? "from-gray-400 to-gray-500")} />
      <CardHeader>
        <CardTitle className="truncate">{account.name}</CardTitle>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Account actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="secondary">{capitalize(account.type)}</Badge>
          <Badge variant={STATUS_VARIANT[account.status]}>{capitalize(account.status)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-bold tabular-nums">
          {formatCurrency(balance, account.currency)}
        </p>

        {isCredit && (
          <div className="space-y-2 text-sm">
            {account.cardNumber && (
              <p className="font-mono text-muted-foreground">
                •••• {account.cardNumber}
              </p>
            )}
            {creditLimit != null && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Credit limit</span>
                <span className="tabular-nums text-foreground">
                  {formatCurrency(creditLimit, account.currency)}
                </span>
              </div>
            )}
            {utilization != null && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Utilization</span>
                  <span className="tabular-nums">{utilization.toFixed(0)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      utilization >= 80
                        ? "bg-gradient-to-r from-rose-500 to-red-600"
                        : "bg-gradient-to-r from-indigo-500 to-purple-500",
                    )}
                    style={{ width: `${utilization}%` }}
                  />
                </div>
              </div>
            )}
            {(account.billGenerationDate != null || account.paymentDueDate != null) && (
              <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                {account.billGenerationDate != null && (
                  <span>Bill day: {account.billGenerationDate}</span>
                )}
                {account.paymentDueDate != null && (
                  <span>Due day: {account.paymentDueDate}</span>
                )}
              </div>
            )}
          </div>
        )}

        {hasInterest && interestRate != null && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Interest rate</span>
            <span className="tabular-nums text-foreground">{interestRate}%</span>
          </div>
        )}

        {account.accountNumber && (
          <p className="text-xs text-muted-foreground">A/C {account.accountNumber}</p>
        )}
      </CardContent>
    </Card>
  );
}
