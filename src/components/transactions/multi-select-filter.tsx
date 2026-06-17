"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type MultiOption = { value: string; label: string; color?: string };

export const NONE_VALUE = "none";

type Props = {
  label: string;
  options: MultiOption[];
  /** Selected values (may include the special NONE_VALUE). */
  selected: string[];
  onChange: (next: string[]) => void;
  /** Whether the selection is an exclusion ("is not any of"). */
  exclude: boolean;
  onExcludeChange: (next: boolean) => void;
  /** Adds a "— None —" option (e.g. uncategorised / no payee). */
  withNone?: boolean;
  noneLabel?: string;
};

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  exclude,
  onExcludeChange,
  withNone = false,
  noneLabel = "— None —",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const allOptions = useMemo<MultiOption[]>(
    () => (withNone ? [{ value: NONE_VALUE, label: noneLabel }, ...options] : options),
    [withNone, noneLabel, options],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return allOptions;
    return allOptions.filter((o) => o.label.toLowerCase().includes(term));
  }, [allOptions, search]);

  const selectedSet = new Set(selected);

  function toggle(value: string) {
    const next = new Set(selectedSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange([...next]);
  }

  const count = selected.length;
  const triggerLabel =
    count === 0
      ? `All ${label.toLowerCase()}`
      : count === 1
        ? (allOptions.find((o) => o.value === selected[0])?.label ?? `1 selected`)
        : `${exclude ? "Not " : ""}${count} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-between font-normal",
            count > 0 && "border-primary/50",
          )}
        >
          <span className="truncate">
            {exclude && count > 0 && (
              <span className="mr-1 text-xs font-medium text-destructive">not</span>
            )}
            {triggerLabel}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="flex items-center justify-between gap-2 border-b p-2">
          <button
            type="button"
            onClick={() => onExcludeChange(false)}
            className={cn(
              "flex-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors",
              !exclude ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            Include
          </button>
          <button
            type="button"
            onClick={() => onExcludeChange(true)}
            className={cn(
              "flex-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors",
              exclude ? "bg-destructive text-white" : "text-muted-foreground hover:bg-muted",
            )}
          >
            Exclude
          </button>
        </div>
        <div className="relative border-b p-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}...`}
            className="h-8 pl-7 text-sm"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">No matches</p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <Checkbox checked={selectedSet.has(o.value)} className="pointer-events-none" />
                {o.color && (
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: o.color }}
                  />
                )}
                <span className="truncate">{o.label}</span>
              </button>
            ))
          )}
        </div>
        {count > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-xs"
              onClick={() => onChange([])}
            >
              <X className="size-3.5" />
              Clear {label.toLowerCase()}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
