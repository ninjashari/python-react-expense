"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { apiFetch, ApiError } from "@/lib/client";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const NONE = "__none__";

type FieldKey =
  | "date"
  | "amount"
  | "type"
  | "accountName"
  | "toAccountName"
  | "categoryName"
  | "payeeName"
  | "description"
  | "notes"
  | "name"
  | "color"
  | "balance"
  | "accountNumber"
  | "creditLimit"
  | "status"
  | "openingDate"
  | "currency";

type FieldDef = { key: FieldKey; label: string; required: boolean; guess: string[] };

type EntityKind = "transactions" | "accounts" | "categories" | "payees";

type ImportResult = { imported: number; failed: Array<{ row: number; reason: string }> };

function normalizeType(raw: string): "income" | "expense" | "transfer" {
  const v = raw.trim().toLowerCase();
  if (v.includes("credit") || v.includes("income") || v.includes("deposit")) return "income";
  if (v.includes("transfer")) return "transfer";
  return "expense";
}

const ACCOUNT_TYPES = ["checking", "savings", "credit", "cash", "investment", "ppf"] as const;
const ACCOUNT_STATUSES = ["active", "inactive", "closed"] as const;

function normalizeAccountType(raw: string): (typeof ACCOUNT_TYPES)[number] {
  const v = raw.trim().toLowerCase();
  const match = ACCOUNT_TYPES.find((t) => t === v || v.includes(t));
  return match ?? "checking";
}

function normalizeAccountStatus(raw: string): (typeof ACCOUNT_STATUSES)[number] {
  const v = raw.trim().toLowerCase();
  const match = ACCOUNT_STATUSES.find((s) => s === v || v.includes(s));
  return match ?? "active";
}

type EntityConfig = {
  label: string;
  endpoint: string;
  description: string;
  fields: FieldDef[];
  mapRow: (valueFor: (key: FieldKey) => string) => Record<string, unknown>;
  previewColumns: Array<{ key: string; label: string }>;
  successNoun: (n: number) => string;
};

const ENTITY_CONFIGS: Record<EntityKind, EntityConfig> = {
  transactions: {
    label: "Transactions",
    endpoint: "/api/import",
    description:
      "Upload a CSV or Excel (.xlsx) file containing your transactions. Accounts must already exist; categories and payees referenced by name will be created automatically.",
    fields: [
      { key: "date", label: "Date", required: true, guess: ["date"] },
      { key: "amount", label: "Amount", required: true, guess: ["amount"] },
      { key: "type", label: "Type", required: true, guess: ["type"] },
      { key: "accountName", label: "Account", required: true, guess: ["account"] },
      {
        key: "toAccountName",
        label: "To account",
        required: false,
        guess: ["to account", "toaccount", "destination"],
      },
      { key: "categoryName", label: "Category", required: false, guess: ["category"] },
      { key: "payeeName", label: "Payee", required: false, guess: ["payee", "merchant"] },
      { key: "description", label: "Description", required: false, guess: ["description", "memo"] },
      { key: "notes", label: "Notes", required: false, guess: ["notes", "note"] },
    ],
    mapRow: (valueFor) => ({
      date: valueFor("date"),
      amount: Number(valueFor("amount").replace(/[^0-9.-]/g, "")) || 0,
      type: normalizeType(valueFor("type")),
      accountName: valueFor("accountName"),
      toAccountName: valueFor("toAccountName") || null,
      categoryName: valueFor("categoryName") || null,
      payeeName: valueFor("payeeName") || null,
      description: valueFor("description") || null,
      notes: valueFor("notes") || null,
    }),
    previewColumns: [
      { key: "date", label: "Date" },
      { key: "type", label: "Type" },
      { key: "accountName", label: "Account" },
      { key: "toAccountName", label: "To account" },
      { key: "categoryName", label: "Category" },
      { key: "payeeName", label: "Payee" },
      { key: "amount", label: "Amount" },
      { key: "description", label: "Description" },
    ],
    successNoun: (n) => `transaction${n === 1 ? "" : "s"}`,
  },
  accounts: {
    label: "Accounts",
    endpoint: "/api/import/accounts",
    description:
      "Upload a CSV or Excel (.xlsx) file containing your accounts. Rows whose name matches an existing account will be skipped.",
    fields: [
      { key: "name", label: "Name", required: true, guess: ["name", "account"] },
      { key: "type", label: "Type", required: true, guess: ["type"] },
      { key: "accountNumber", label: "Account number", required: false, guess: ["account number", "acct"] },
      { key: "creditLimit", label: "Credit limit", required: false, guess: ["credit limit"] },
      { key: "status", label: "Status", required: false, guess: ["status"] },
      { key: "openingDate", label: "Opening date", required: false, guess: ["opening date"] },
      { key: "currency", label: "Currency", required: false, guess: ["currency"] },
    ],
    mapRow: (valueFor) => ({
      name: valueFor("name"),
      type: normalizeAccountType(valueFor("type")),
      balance: 0,
      accountNumber: valueFor("accountNumber") || null,
      creditLimit: valueFor("creditLimit")
        ? Number(valueFor("creditLimit").replace(/[^0-9.-]/g, ""))
        : null,
      status: valueFor("status") ? normalizeAccountStatus(valueFor("status")) : "active",
      openingDate: valueFor("openingDate") || null,
      currency: (valueFor("currency") || "INR").toUpperCase(),
    }),
    previewColumns: [
      { key: "name", label: "Name" },
      { key: "type", label: "Type" },
      { key: "accountNumber", label: "Account number" },
      { key: "status", label: "Status" },
      { key: "currency", label: "Currency" },
    ],
    successNoun: (n) => `account${n === 1 ? "" : "s"}`,
  },
  categories: {
    label: "Categories",
    endpoint: "/api/import/categories",
    description:
      "Upload a CSV or Excel (.xlsx) file containing your categories. Rows matching an existing category name will be skipped.",
    fields: [
      { key: "name", label: "Name", required: true, guess: ["name", "category"] },
      { key: "color", label: "Color", required: false, guess: ["color", "colour"] },
    ],
    mapRow: (valueFor) => ({
      name: valueFor("name"),
      color: valueFor("color") || undefined,
    }),
    previewColumns: [
      { key: "name", label: "Name" },
      { key: "color", label: "Color" },
    ],
    successNoun: (n) => `categor${n === 1 ? "y" : "ies"}`,
  },
  payees: {
    label: "Payees",
    endpoint: "/api/import/payees",
    description:
      "Upload a CSV or Excel (.xlsx) file containing your payees. Rows matching an existing payee name will be skipped.",
    fields: [
      { key: "name", label: "Name", required: true, guess: ["name", "payee", "merchant"] },
      { key: "color", label: "Color", required: false, guess: ["color", "colour"] },
    ],
    mapRow: (valueFor) => ({
      name: valueFor("name"),
      color: valueFor("color") || undefined,
    }),
    previewColumns: [
      { key: "name", label: "Name" },
      { key: "color", label: "Color" },
    ],
    successNoun: (n) => `payee${n === 1 ? "" : "s"}`,
  },
};

function guessColumn(headers: string[], guesses: string[]): string {
  const lower = headers.map((h) => h.toLowerCase());
  for (const guess of guesses) {
    const idx = lower.findIndex((h) => h.includes(guess));
    if (idx !== -1) return headers[idx];
  }
  return NONE;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(content: string | Blob, filename: string) {
  const blob = content instanceof Blob ? content : new Blob([content]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ImportExportClient() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entity, setEntity] = useState<EntityKind>("transactions");
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sourceRows, setSourceRows] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({} as Record<FieldKey, string>);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const config = ENTITY_CONFIGS[entity];

  function handleEntityChange(next: EntityKind) {
    setEntity(next);
    setFileName(null);
    setHeaders([]);
    setSourceRows([]);
    setMapping({} as Record<FieldKey, string>);
    setResult(null);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
      if (rows.length === 0) {
        toast.error("The file appears to be empty");
        return;
      }
      const headerRow = (rows[0] as unknown[]).map((h) => String(h ?? ""));
      const dataRows = rows.slice(1).filter((r) => Array.isArray(r) && r.length > 0);

      const initialMapping = {} as Record<FieldKey, string>;
      for (const field of config.fields) {
        initialMapping[field.key] = guessColumn(headerRow, field.guess);
      }

      setFileName(file.name);
      setHeaders(headerRow);
      setSourceRows(dataRows);
      setMapping(initialMapping);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const mapRow = useCallback(
    (row: unknown[]): Record<string, unknown> => {
      function valueFor(key: FieldKey): string {
        const col = mapping[key];
        if (!col || col === NONE) return "";
        const idx = headers.indexOf(col);
        if (idx === -1) return "";
        const v = row[idx];
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        return v === undefined || v === null ? "" : String(v).trim();
      }

      return config.mapRow(valueFor);
    },
    [mapping, headers, config],
  );

  const previewRows = useMemo(() => sourceRows.slice(0, 10).map(mapRow), [sourceRows, mapRow]);

  const requiredMapped = config.fields
    .filter((f) => f.required)
    .every((f) => mapping[f.key] && mapping[f.key] !== NONE);

  async function handleImport() {
    if (!requiredMapped) {
      toast.error("Map all required fields before importing");
      return;
    }
    const allRows = sourceRows.map(mapRow);
    setImporting(true);
    setResult(null);
    try {
      const res = await apiFetch<ImportResult>(config.endpoint, {
        method: "POST",
        body: allRows,
      });
      setResult(res);
      if (res.failed.length === 0) {
        toast.success(`Imported ${res.imported} ${config.successNoun(res.imported)}`);
        resetImport();
      } else {
        toast.warning(
          `Imported ${res.imported}, ${res.failed.length} failed. See details below.`,
        );
      }
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error(err instanceof Error ? err.message : "Import failed");
      }
    } finally {
      setImporting(false);
    }
  }

  function resetImport() {
    setFileName(null);
    setHeaders([]);
    setSourceRows([]);
    setMapping({} as Record<FieldKey, string>);
    setResult(null);
  }

  async function handleExportJson() {
    setExportingJson(true);
    try {
      const res = await fetch("/api/export?format=json");
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const text = await res.text();
      downloadBlob(text, `ledgerly-backup-${todayStr()}.json`);
      toast.success("Backup exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export backup");
    } finally {
      setExportingJson(false);
    }
  }

  async function handleExportCsv() {
    setExportingCsv(true);
    try {
      const res = await fetch("/api/export?format=csv");
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const text = await res.text();
      downloadBlob(text, `transactions-${todayStr()}.csv`);
      toast.success("Transactions exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export transactions");
    } finally {
      setExportingCsv(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Data"
        description="Import accounts, categories, payees, or transactions from a spreadsheet, or export a backup of your data."
      />

      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload file</CardTitle>
              <CardDescription>{config.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:max-w-xs">
                <Label htmlFor="import-entity">What are you importing?</Label>
                <Select value={entity} onValueChange={(v) => handleEntityChange(v as EntityKind)}>
                  <SelectTrigger id="import-entity" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ENTITY_CONFIGS) as EntityKind[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {ENTITY_CONFIGS[key].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="import-file-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={parsing}
                >
                  {parsing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Choose file
                </Button>
                {fileName && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <FileSpreadsheet className="size-4" />
                    {fileName} ({sourceRows.length} row{sourceRows.length === 1 ? "" : "s"})
                  </span>
                )}
                {fileName && (
                  <Button type="button" variant="ghost" size="sm" onClick={resetImport}>
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {headers.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Map columns</CardTitle>
                  <CardDescription>
                    Match each field to a column from your file. Fields marked optional can be
                    left unmapped.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {config.fields.map((field) => (
                      <div key={field.key} className="grid gap-2">
                        <Label htmlFor={`map-${field.key}`}>
                          {field.label}
                          {field.required && <span className="text-destructive"> *</span>}
                        </Label>
                        <Select
                          value={mapping[field.key] || NONE}
                          onValueChange={(v) =>
                            setMapping((prev) => ({ ...prev, [field.key]: v }))
                          }
                        >
                          <SelectTrigger id={`map-${field.key}`} className="w-full">
                            <SelectValue placeholder="— none —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>— none —</SelectItem>
                            {headers.map((h, idx) => (
                              <SelectItem key={`${h}-${idx}`} value={h}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                  <CardDescription>First 10 rows as they will be imported.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {config.previewColumns.map((col) => (
                          <TableHead key={col.key}>{col.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, idx) => (
                        <TableRow key={idx}>
                          {config.previewColumns.map((col) => (
                            <TableCell key={col.key}>
                              {row[col.key] as React.ReactNode}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <Button onClick={handleImport} disabled={importing || !requiredMapped}>
                      {importing && <Loader2 className="size-4 animate-spin" />}
                      Import {sourceRows.length} row{sourceRows.length === 1 ? "" : "s"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {result && result.failed.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Import issues</CardTitle>
                <CardDescription>
                  {result.failed.length} row{result.failed.length === 1 ? "" : "s"} could not be
                  imported.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {result.failed.map((f, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      Row {f.row + 1}: {f.reason}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card className="group overflow-hidden transition-shadow hover:shadow-sm">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
            <CardHeader>
              <CardTitle>Export backup</CardTitle>
              <CardDescription>
                Download a full JSON backup of your accounts, categories, payees, and
                transactions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleExportJson} disabled={exportingJson}>
                {exportingJson ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Export backup (JSON)
              </Button>
            </CardContent>
          </Card>

          <Card className="group overflow-hidden transition-shadow hover:shadow-sm">
            <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
            <CardHeader>
              <CardTitle>Export transactions</CardTitle>
              <CardDescription>
                Download all of your transactions as a CSV file, ready to open in a spreadsheet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleExportCsv} disabled={exportingCsv}>
                {exportingCsv ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Export transactions (CSV)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
