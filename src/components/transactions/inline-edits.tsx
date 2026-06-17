"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const triggerClass =
  "flex w-full items-center gap-1 rounded-sm px-1.5 py-1 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

/** Click-to-edit text/number/date cell. Commits on blur or Enter, cancels on Escape. */
export function InlineInput({
  value,
  type = "text",
  display,
  align = "left",
  inputClassName,
  onCommit,
}: {
  value: string;
  type?: "text" | "number" | "date";
  display: React.ReactNode;
  align?: "left" | "right";
  inputClassName?: string;
  onCommit: (next: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const committed = useRef(false);

  async function commit() {
    if (committed.current) return;
    committed.current = true;
    if (draft.trim() === value.trim() || draft.trim() === "") {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onCommit(draft.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        className={cn(triggerClass, align === "right" && "justify-end")}
        onClick={() => {
          committed.current = false;
          setDraft(value);
          setEditing(true);
        }}
      >
        {display}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <Input
        autoFocus
        type={type}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            committed.current = true;
            setEditing(false);
          }
        }}
        className={cn("h-8", align === "right" && "text-right", inputClassName)}
      />
      {saving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
    </span>
  );
}

/** Click-to-edit select cell. Opens immediately; commits on selection. */
export function InlineSelect({
  value,
  display,
  options,
  noneLabel,
  onCommit,
}: {
  value: string;
  display: React.ReactNode;
  options: { value: string; label: string }[];
  noneLabel: string;
  onCommit: (next: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        className={triggerClass}
        onClick={() => setEditing(true)}
      >
        {display}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <Select
        defaultOpen
        value={value}
        onValueChange={async (v) => {
          setEditing(false);
          if (v === value) return;
          setSaving(true);
          try {
            await onCommit(v);
          } finally {
            setSaving(false);
          }
        }}
        onOpenChange={(open) => {
          if (!open) setEditing(false);
        }}
      >
        <SelectTrigger className="h-8 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{noneLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {saving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
    </span>
  );
}
