"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Account, AccountStatus, AccountType } from "./accounts-client";

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit", label: "Credit" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
  { value: "ppf", label: "PPF" },
];

const STATUSES: { value: AccountStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "closed", label: "Closed" },
];

const CURRENCIES = ["INR", "USD", "EUR", "GBP"];

type Props = {
  account?: Account;
  onSaved: () => void;
};

/** Convert a possibly-empty string to a number, or undefined when blank. */
function numOrUndef(v: string): number | undefined {
  const t = v.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function intOrUndef(v: string): number | undefined {
  const n = numOrUndef(v);
  return n === undefined ? undefined : Math.trunc(n);
}

export function AccountForm({ account, onSaved }: Props) {
  const isEdit = !!account;
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "checking");
  const [balance, setBalance] = useState(
    account ? String(Number(account.openingBalance)) : "0",
  );
  const [currency, setCurrency] = useState(account?.currency ?? "INR");
  const [status, setStatus] = useState<AccountStatus>(account?.status ?? "active");
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? "");
  const [cardNumber, setCardNumber] = useState(account?.cardNumber ?? "");
  const [creditLimit, setCreditLimit] = useState(
    account?.creditLimit != null ? String(Number(account.creditLimit)) : "",
  );
  const [billGenerationDate, setBillGenerationDate] = useState(
    account?.billGenerationDate != null ? String(account.billGenerationDate) : "",
  );
  const [paymentDueDate, setPaymentDueDate] = useState(
    account?.paymentDueDate != null ? String(account.paymentDueDate) : "",
  );
  const [interestRate, setInterestRate] = useState(
    account?.interestRate != null ? String(Number(account.interestRate)) : "",
  );

  const isCredit = type === "credit";
  const hasInterest = type === "ppf" || type === "investment";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (isCredit && cardNumber && !/^\d{4}$/.test(cardNumber)) {
      toast.error("Card last-4 must be exactly 4 digits");
      return;
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      type,
      balance: numOrUndef(balance) ?? 0,
      currency,
      status,
      accountNumber: accountNumber.trim() || undefined,
    };

    if (isCredit) {
      payload.cardNumber = cardNumber.trim() || undefined;
      payload.creditLimit = numOrUndef(creditLimit);
      payload.billGenerationDate = intOrUndef(billGenerationDate);
      payload.paymentDueDate = intOrUndef(paymentDueDate);
    }
    if (hasInterest) {
      payload.interestRate = numOrUndef(interestRate);
    }

    setSaving(true);
    try {
      if (isEdit) {
        await apiFetch(`/api/accounts/${account.id}`, { method: "PUT", body: payload });
        toast.success("Account updated");
      } else {
        await apiFetch("/api/accounts", { method: "POST", body: payload });
        toast.success("Account created");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="acc-name">Name</Label>
        <Input
          id="acc-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. HDFC Savings"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="acc-type">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
            <SelectTrigger id="acc-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="acc-status">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as AccountStatus)}>
            <SelectTrigger id="acc-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="acc-balance">Opening balance</Label>
          <Input
            id="acc-balance"
            type="number"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="acc-currency">Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id="acc-currency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="acc-number">Account number</Label>
        <Input
          id="acc-number"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          placeholder="Optional"
        />
      </div>

      {isCredit && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="acc-card">Card last-4</Label>
            <Input
              id="acc-card"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acc-limit">Credit limit</Label>
            <Input
              id="acc-limit"
              type="number"
              step="0.01"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acc-bill">Bill generation day</Label>
            <Input
              id="acc-bill"
              type="number"
              min={1}
              max={31}
              value={billGenerationDate}
              onChange={(e) => setBillGenerationDate(e.target.value)}
              placeholder="1-31"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acc-due">Payment due day</Label>
            <Input
              id="acc-due"
              type="number"
              min={1}
              max={31}
              value={paymentDueDate}
              onChange={(e) => setPaymentDueDate(e.target.value)}
              placeholder="1-31"
            />
          </div>
        </div>
      )}

      {hasInterest && (
        <div className="space-y-2">
          <Label htmlFor="acc-rate">Interest rate (%)</Label>
          <Input
            id="acc-rate"
            type="number"
            step="0.001"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            placeholder="Optional"
          />
        </div>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={saving}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Save changes" : "Create account"}
        </Button>
      </DialogFooter>
    </form>
  );
}
