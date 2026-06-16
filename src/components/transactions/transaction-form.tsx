"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AccountOption, Option, Tx, TxType } from "./types";

const NONE = "__none__";

function today() {
  return new Date().toISOString().slice(0, 10);
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Tx | null;
  accounts: AccountOption[];
  categories: Option[];
  payees: Option[];
  onSaved: () => void;
};

export function TransactionForm({
  open,
  onOpenChange,
  editing,
  accounts,
  categories,
  payees,
  onSaved,
}: Props) {
  const [type, setType] = useState<TxType>(editing?.type ?? "expense");
  const [accountId, setAccountId] = useState(editing?.accountId ?? "");
  const [toAccountId, setToAccountId] = useState(editing?.toAccountId ?? "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? NONE);
  const [payeeId, setPayeeId] = useState(editing?.payeeId ?? NONE);
  const [amount, setAmount] = useState(editing ? String(Number(editing.amount)) : "");
  const [date, setDate] = useState(editing?.date ?? today());
  const [description, setDescription] = useState(editing?.description ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [rewardPoints, setRewardPoints] = useState(
    editing?.rewardPoints != null ? String(Number(editing.rewardPoints)) : "",
  );
  const [saving, setSaving] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const isCredit = selectedAccount?.type === "credit";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) {
      toast.error("Account is required");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    if (!date) {
      toast.error("Date is required");
      return;
    }
    if (type === "transfer") {
      if (!toAccountId) {
        toast.error("To account is required for transfers");
        return;
      }
      if (toAccountId === accountId) {
        toast.error("To account must differ from the source account");
        return;
      }
    }

    const payload = {
      type,
      accountId,
      toAccountId: type === "transfer" ? toAccountId : undefined,
      categoryId: categoryId === NONE ? undefined : categoryId,
      payeeId: payeeId === NONE ? undefined : payeeId,
      amount: amt,
      date,
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      rewardPoints: isCredit && rewardPoints ? Number(rewardPoints) : undefined,
    };

    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/api/transactions/${editing.id}`, { method: "PUT", body: payload });
        toast.success("Transaction updated");
      } else {
        await apiFetch("/api/transactions", { method: "POST", body: payload });
        toast.success("Transaction created");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save transaction");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit transaction" : "Add transaction"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update the details below." : "Record a new transaction."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="tx-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as TxType)}>
              <SelectTrigger id="tx-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tx-account">Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="tx-account" className="w-full">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === "transfer" && (
            <div className="grid gap-2">
              <Label htmlFor="tx-to-account">To account</Label>
              <Select value={toAccountId} onValueChange={setToAccountId}>
                <SelectTrigger id="tx-to-account" className="w-full">
                  <SelectValue placeholder="Select destination account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tx-amount">Amount</Label>
              <Input
                id="tx-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tx-date">Date</Label>
              <Input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {type !== "transfer" && (
            <div className="grid gap-2">
              <Label htmlFor="tx-category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="tx-category" className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="tx-payee">Payee</Label>
            <Select value={payeeId} onValueChange={setPayeeId}>
              <SelectTrigger id="tx-payee" className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No payee</SelectItem>
                {payees.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tx-description">Description</Label>
            <Input
              id="tx-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tx-notes">Notes</Label>
            <Textarea
              id="tx-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={2}
            />
          </div>

          {isCredit && (
            <div className="grid gap-2">
              <Label htmlFor="tx-reward">Reward points</Label>
              <Input
                id="tx-reward"
                type="number"
                min="0"
                value={rewardPoints}
                onChange={(e) => setRewardPoints(e.target.value)}
                placeholder="Optional"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
