"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { fetcher } from "@/lib/swr";
import { apiFetch } from "@/lib/client";
import { toast } from "sonner";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { TransactionForm } from "./transaction-form";
import type { AccountOption, Option, Tx, TxPage, TxType } from "./types";

const PAGE_SIZE = 25;
const ALL = "all";

type FilterType = TxType | "all";

const TYPE_BADGE: Record<TxType, "default" | "secondary" | "outline"> = {
  income: "default",
  expense: "secondary",
  transfer: "outline",
};

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function TransactionsClient() {
  const [page, setPage] = useState(1);
  const [accountId, setAccountId] = useState<string>(ALL);
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [payeeId, setPayeeId] = useState<string>(ALL);
  const [type, setType] = useState<FilterType>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);

  const [sort] = useState<"date" | "amount" | "created">("date");
  const [order] = useState<"asc" | "desc">("desc");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [deleting, setDeleting] = useState<Tx | null>(null);

  // Changing any filter resets pagination to the first page. Wrap each setter
  // so the reset happens in the event handler (not synchronously in an effect).
  function withReset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  const onAccount = withReset(setAccountId);
  const onCategory = withReset(setCategoryId);
  const onPayee = withReset(setPayeeId);
  const onType = withReset<FilterType>(setType);
  const onFrom = withReset(setFrom);
  const onTo = withReset(setTo);
  const onSearch = withReset(setSearch);

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    params.set("sort", sort);
    params.set("order", order);
    if (accountId !== ALL) params.set("accountId", accountId);
    if (categoryId !== ALL) params.set("categoryId", categoryId);
    if (payeeId !== ALL) params.set("payeeId", payeeId);
    if (type !== "all") params.set("type", type);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    return params.toString();
  }, [page, sort, order, accountId, categoryId, payeeId, type, from, to, debouncedSearch]);

  const { data, isLoading, mutate } = useSWR<TxPage>(`/api/transactions?${qs}`, fetcher);
  const { data: accounts } = useSWR<AccountOption[]>("/api/accounts", fetcher);
  const { data: categories } = useSWR<Option[]>("/api/categories", fetcher);
  const { data: payees } = useSWR<Option[]>("/api/payees", fetcher);

  const accountOptions = accounts ?? [];
  const categoryOptions = categories ?? [];
  const payeeOptions = payees ?? [];

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const hasFilters =
    accountId !== ALL ||
    categoryId !== ALL ||
    payeeId !== ALL ||
    type !== "all" ||
    Boolean(from) ||
    Boolean(to) ||
    Boolean(debouncedSearch.trim());

  function clearFilters() {
    setAccountId(ALL);
    setCategoryId(ALL);
    setPayeeId(ALL);
    setType("all");
    setFrom("");
    setTo("");
    setSearch("");
    setPage(1);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(tx: Tx) {
    setEditing(tx);
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await apiFetch(`/api/transactions/${deleting.id}`, { method: "DELETE" });
      toast.success("Transaction deleted");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete transaction");
    }
  }

  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      <PageHeader title="Transactions" description="Track income, expenses and transfers.">
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add transaction
        </Button>
      </PageHeader>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2 sm:col-span-2 lg:col-span-2">
            <Label htmlFor="filter-search">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="filter-search"
                className="pl-8"
                placeholder="Search description or notes"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => onType(v as FilterType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Account</Label>
            <Select value={accountId} onValueChange={onAccount}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All accounts</SelectItem>
                {accountOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={onCategory}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categoryOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Payee</Label>
            <Select value={payeeId} onValueChange={onPayee}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All payees</SelectItem>
                {payeeOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="filter-from">From</Label>
            <Input
              id="filter-from"
              type="date"
              value={from}
              onChange={(e) => onFrom(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="filter-to">To</Label>
            <Input
              id="filter-to"
              type="date"
              value={to}
              onChange={(e) => onTo(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="w-full sm:w-auto"
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : items.length === 0 ? (
            <div className="p-6">
              {hasFilters ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No transactions match your filters.
                </p>
              ) : (
                <EmptyState
                  icon={ArrowLeftRight}
                  title="No transactions yet"
                  description="Add your first transaction to get started."
                  action={
                    <Button onClick={openCreate}>
                      <Plus className="size-4" />
                      Add transaction
                    </Button>
                  }
                />
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description / Payee</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    onEdit={() => openEdit(tx)}
                    onDelete={() => setDeleting(tx)}
                  />
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {!isLoading && items.length > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t p-4 sm:flex-row">
              <p className="text-sm text-muted-foreground">
                Showing {start}–{end} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="size-4" />
                  Prev
                </Button>
                <span className="text-sm tabular-nums text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {formOpen && (
        <TransactionForm
          key={editing?.id ?? "new"}
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          accounts={accountOptions}
          categories={categoryOptions}
          payees={payeeOptions}
          onSaved={() => mutate()}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete transaction?"
        description="This action cannot be undone."
        onConfirm={handleDelete}
      />
    </div>
  );
}

function TransactionRow({
  tx,
  onEdit,
  onDelete,
}: {
  tx: Tx;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const amount = Number(tx.amount);
  const primary = tx.payeeName || tx.description || "Transaction";

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
        {formatDate(tx.date)}
      </TableCell>
      <TableCell className="font-medium">{primary}</TableCell>
      <TableCell>
        {tx.categoryName ? (
          <span className="inline-flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: tx.categoryColor ?? "#94a3b8" }}
            />
            {tx.categoryName}
          </span>
        ) : (
          <span className="text-muted-foreground">Uncategorized</span>
        )}
      </TableCell>
      <TableCell className="text-sm">{tx.accountName ?? "—"}</TableCell>
      <TableCell>
        <Badge variant={TYPE_BADGE[tx.type]} className="capitalize">
          {tx.type}
        </Badge>
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-semibold tabular-nums",
          tx.type === "income" && "text-emerald-500",
          tx.type === "expense" && "text-rose-500",
        )}
      >
        {tx.type === "income" && "+"}
        {tx.type === "expense" && "−"}
        {tx.type === "transfer" && "⇄ "}
        {formatCurrency(amount)}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Open actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
