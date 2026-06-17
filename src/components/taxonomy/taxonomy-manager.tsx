"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MoreHorizontal, Palette, Pencil, Plus, Search, Sparkles, Store, Tags, Trash2 } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { apiFetch, ApiError } from "@/lib/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type TaxonomyItem = {
  id: string;
  name: string;
  slug: string;
  color: string;
  txnCount: number;
};

const ICONS = { Tags, Store };

type Props = {
  title: string;
  description: string;
  endpoint: string;
  defaultColor: string;
  icon: keyof typeof ICONS;
};

/** Debounce a value by `delay` ms. The setState runs inside a timer (async),
 * so it does not trip the react-hooks/set-state-in-effect rule. */
function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function TaxonomyManager({ title, description, endpoint, defaultColor, icon }: Props) {
  const Icon = ICONS[icon];
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search.trim(), 300);

  const key = debouncedSearch
    ? `${endpoint}?search=${encodeURIComponent(debouncedSearch)}`
    : endpoint;
  const { data, isLoading, mutate } = useSWR<TaxonomyItem[]>(key, fetcher);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaxonomyItem | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(defaultColor);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<TaxonomyItem | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [recoloring, setRecoloring] = useState(false);

  const items = data ?? [];
  const isSearching = debouncedSearch.length > 0;
  const unusedCount = items.filter((i) => i.txnCount === 0).length;

  const singular = useMemo(
    () => (title.endsWith("ies") ? `${title.slice(0, -3)}y` : title.replace(/s$/, "")),
    [title],
  );

  function openCreate() {
    setEditing(null);
    setName("");
    setColor(defaultColor);
    setFormOpen(true);
  }

  function openEdit(item: TaxonomyItem) {
    setEditing(item);
    setName(item.name);
    setColor(item.color);
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`${endpoint}/${editing.id}`, {
          method: "PUT",
          body: { name: trimmed, color },
        });
        toast.success(`${singular} updated`);
      } else {
        await apiFetch(endpoint, {
          method: "POST",
          body: { name: trimmed, color },
        });
        toast.success(`${singular} created`);
      }
      setFormOpen(false);
      mutate();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(err.message || `A ${singular.toLowerCase()} with that name already exists`);
      } else {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await apiFetch(`${endpoint}/${deleting.id}`, { method: "DELETE" });
      toast.success(`${singular} deleted`);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleRecolor() {
    setRecoloring(true);
    try {
      const res = await apiFetch<{ recolored: number }>(`${endpoint}/recolor`, { method: "POST" });
      toast.success(
        `Reassigned colours to ${res.recolored} ${res.recolored === 1 ? singular.toLowerCase() : title.toLowerCase()}`,
      );
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reassign colours");
    } finally {
      setRecoloring(false);
    }
  }

  async function handleCleanup() {
    setCleaning(true);
    try {
      const res = await apiFetch<{ deleted: number }>(`${endpoint}/unused`, { method: "DELETE" });
      toast.success(`Removed ${res.deleted} unused ${res.deleted === 1 ? singular.toLowerCase() : title.toLowerCase()}`);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clean up");
    } finally {
      setCleaning(false);
    }
  }

  return (
    <div>
      <PageHeader title={title} description={description}>
        {items.length > 0 && (
          <Button variant="outline" onClick={handleRecolor} disabled={recoloring}>
            {recoloring ? <Loader2 className="size-4 animate-spin" /> : <Palette className="size-4" />}
            Reassign colours
          </Button>
        )}
        {unusedCount > 0 && (
          <Button variant="outline" onClick={handleCleanup} disabled={cleaning}>
            {cleaning ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Remove unused ({unusedCount})
          </Button>
        )}
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add {singular.toLowerCase()}
        </Button>
      </PageHeader>

      <div className="mb-4 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={`Search ${title.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={isSearching ? `No ${title.toLowerCase()} found` : `No ${title.toLowerCase()} yet`}
          description={
            isSearching
              ? "Try a different search term."
              : `Create your first ${singular.toLowerCase()} to start organising transactions.`
          }
          action={
            !isSearching ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Add {singular.toLowerCase()}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <CardContent className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between gap-3 rounded-xl border p-3 transition-all duration-200 hover:border-primary/20 hover:shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="size-4 shrink-0 rounded-full shadow-sm ring-2 ring-white dark:ring-card"
                    style={{ backgroundColor: item.color }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.name}</p>
                    <Badge variant="secondary" className="mt-0.5 font-normal text-muted-foreground">
                      {item.txnCount} transaction{item.txnCount === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 shrink-0">
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => openEdit(item)}>
                      <Pencil className="size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(item)}>
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editing ? `Edit ${singular.toLowerCase()}` : `New ${singular.toLowerCase()}`}</DialogTitle>
              <DialogDescription>
                {editing
                  ? `Update the name or colour for this ${singular.toLowerCase()}.`
                  : `Add a new ${singular.toLowerCase()} to categorise transactions.`}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="taxonomy-name">Name</Label>
                <Input
                  id="taxonomy-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`e.g. ${title === "Categories" ? "Groceries" : "Amazon"}`}
                  required
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="taxonomy-color">Colour</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="taxonomy-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="size-10 cursor-pointer rounded-md border bg-transparent p-1"
                  />
                  <span className="rounded-md border bg-muted px-2 py-1 font-mono text-sm uppercase tabular-nums">
                    {color}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
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

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ""}?`}
        description={`Deleting this ${singular.toLowerCase()} keeps its transactions but unlinks them — they will become uncategorised.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
