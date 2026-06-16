import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { accounts, categories, payees, transactions } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { route } from "@/lib/http";

export const runtime = "nodejs";

function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const GET = route(async (req: Request) => {
  const userId = await requireUserId();
  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";

  if (format === "csv") {
    const rows = await db
      .select({
        date: transactions.date,
        type: transactions.type,
        accountName: accounts.name,
        amount: transactions.amount,
        description: transactions.description,
        notes: transactions.notes,
        categoryName: categories.name,
        payeeName: payees.name,
        toAccountId: transactions.toAccountId,
      })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(payees, eq(transactions.payeeId, payees.id))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date));

    const toAccountIds = [...new Set(rows.map((r) => r.toAccountId).filter((x): x is string => !!x))];
    const toAccountNameById = new Map<string, string>();
    if (toAccountIds.length > 0) {
      const toAccounts = await db
        .select({ id: accounts.id, name: accounts.name })
        .from(accounts)
        .where(eq(accounts.userId, userId));
      for (const a of toAccounts) toAccountNameById.set(a.id, a.name);
    }

    const header = [
      "Date",
      "Type",
      "Account",
      "To Account",
      "Category",
      "Payee",
      "Amount",
      "Description",
      "Notes",
    ];
    const lines = [header.map(csvField).join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.date,
          r.type,
          r.accountName ?? "",
          r.toAccountId ? toAccountNameById.get(r.toAccountId) ?? "" : "",
          r.categoryName ?? "",
          r.payeeName ?? "",
          r.amount,
          r.description ?? "",
          r.notes ?? "",
        ]
          .map(csvField)
          .join(","),
      );
    }
    const csv = lines.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="transactions.csv"',
      },
    });
  }

  const [accountRows, categoryRows, payeeRows, transactionRows] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(payees).where(eq(payees.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
  ]);

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      accounts: accountRows,
      categories: categoryRows,
      payees: payeeRows,
      transactions: transactionRows,
    },
    { headers: { "Content-Disposition": 'attachment; filename="ledgerly-backup.json"' } },
  );
});
