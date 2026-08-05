// Seeds a demo account with a year of realistic data directly via Drizzle.
// Runs as part of the Render build (see render.yaml), so the deployed app
// always has a working demo login after a deploy. Safe to run repeatedly:
// it no-ops if the demo user already exists.
//
// Manual run:  npm run db:seed-demo
// Override the identity with DEMO_EMAIL / DEMO_PASSWORD / DEMO_NAME.
// Skip entirely with SEED_DEMO_DATA=false.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  users,
  accounts,
  categories,
  payees,
  transactions,
  rewardBonuses,
  rewardRedemptions,
  type NewTransaction,
} from "../src/db/schema";
import { recalcAllBalances } from "../src/lib/balance";
import { slugify, chunk } from "../src/lib/utils";

const EMAIL = process.env.DEMO_EMAIL || "demo@ledgerly.app";
const PASSWORD = process.env.DEMO_PASSWORD || "DemoLedger#2026";
const NAME = process.env.DEMO_NAME || "Demo User";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function rnd(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function daysInMonth(y: number, m0: number) {
  return new Date(y, m0 + 1, 0).getDate();
}
function iso(y: number, m0: number, d: number) {
  return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const CATEGORIES: [string, string][] = [
  ["Salary", "#10b981"],
  ["Freelance Income", "#0ea5e9"],
  ["Groceries", "#f59e0b"],
  ["Rent", "#ef4444"],
  ["Utilities", "#06b6d4"],
  ["Dining Out", "#ec4899"],
  ["Transport", "#8b5cf6"],
  ["Fuel", "#a855f7"],
  ["Entertainment", "#f97316"],
  ["Shopping", "#3b82f6"],
  ["Healthcare", "#14b8a6"],
  ["Travel", "#6366f1"],
  ["Insurance", "#64748b"],
  ["Investments", "#22c55e"],
  ["Gifts & Donations", "#eab308"],
];

const PAYEES: [string, string][] = [
  ["Acme Corp", "#10b981"],
  ["Nimbus Design Studio", "#0ea5e9"],
  ["BigBasket", "#f59e0b"],
  ["Shalini Mehta", "#ef4444"],
  ["State Electricity Board", "#06b6d4"],
  ["Airtel", "#0ea5e9"],
  ["Swiggy", "#ec4899"],
  ["Uber", "#8b5cf6"],
  ["Indian Oil", "#a855f7"],
  ["Netflix", "#f97316"],
  ["Amazon", "#3b82f6"],
  ["Apollo Pharmacy", "#14b8a6"],
  ["MakeMyTrip", "#6366f1"],
  ["LIC Insurance", "#64748b"],
  ["Local Charity Trust", "#eab308"],
];

type AccountKey = "checking" | "savings" | "credit" | "cash" | "investment" | "ppf";

async function main() {
  if (process.env.SEED_DEMO_DATA === "false") {
    console.log("SEED_DEMO_DATA=false, skipping demo data seed.");
    return;
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, EMAIL)).limit(1);
  if (existing.length) {
    console.log(`Demo user ${EMAIL} already exists, skipping seed.`);
    return;
  }

  console.log(`Seeding demo data for ${EMAIL} ...`);
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const [user] = await db.insert(users).values({ name: NAME, email: EMAIL, passwordHash }).returning();
  const userId = user.id;

  const categoryId: Record<string, string> = {};
  const categoryRows = await db
    .insert(categories)
    .values(CATEGORIES.map(([name, color]) => ({ userId, name, slug: slugify(name), color })))
    .returning();
  categoryRows.forEach((row, i) => (categoryId[CATEGORIES[i][0]] = row.id));

  const payeeId: Record<string, string> = {};
  const payeeRows = await db
    .insert(payees)
    .values(PAYEES.map(([name, color]) => ({ userId, name, slug: slugify(name), color })))
    .returning();
  payeeRows.forEach((row, i) => (payeeId[PAYEES[i][0]] = row.id));

  const today = new Date();
  const thirteenMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 13, 1);
  const openingDate = iso(thirteenMonthsAgo.getFullYear(), thirteenMonthsAgo.getMonth(), 1);

  const accountDefs: { key: AccountKey; values: typeof accounts.$inferInsert }[] = [
    {
      key: "checking",
      values: {
        userId,
        name: "HDFC Salary Account",
        type: "checking",
        openingBalance: "45000",
        balance: "45000",
        accountNumber: "50100234567890",
        status: "active",
        openingDate,
        currency: "INR",
      },
    },
    {
      key: "savings",
      values: {
        userId,
        name: "ICICI Savings",
        type: "savings",
        openingBalance: "120000",
        balance: "120000",
        accountNumber: "029401123456",
        interestRate: "3.5",
        status: "active",
        openingDate,
        currency: "INR",
      },
    },
    {
      key: "credit",
      values: {
        userId,
        name: "Ledgerly Rewards Visa",
        type: "credit",
        openingBalance: "0",
        balance: "0",
        cardNumber: "4821",
        cardExpiryMonth: 11,
        cardExpiryYear: 2029,
        creditLimit: "200000",
        billGenerationDate: 5,
        paymentDueDate: 25,
        interestRate: "3.49",
        status: "active",
        openingDate,
        currency: "INR",
      },
    },
    {
      key: "cash",
      values: {
        userId,
        name: "Cash Wallet",
        type: "cash",
        openingBalance: "3000",
        balance: "3000",
        status: "active",
        openingDate,
        currency: "INR",
      },
    },
    {
      key: "investment",
      values: {
        userId,
        name: "Zerodha Direct Equity",
        type: "investment",
        openingBalance: "50000",
        balance: "50000",
        status: "active",
        openingDate,
        currency: "INR",
      },
    },
    {
      key: "ppf",
      values: {
        userId,
        name: "PPF Account",
        type: "ppf",
        openingBalance: "80000",
        balance: "80000",
        interestRate: "7.1",
        status: "active",
        openingDate,
        currency: "INR",
      },
    },
  ];

  const accountId: Record<AccountKey, string> = {} as Record<AccountKey, string>;
  const accountRows = await db
    .insert(accounts)
    .values(accountDefs.map((a) => a.values))
    .returning();
  accountRows.forEach((row, i) => (accountId[accountDefs[i].key] = row.id));

  console.log("Generating 12 months of transactions...");
  const months = [] as { year: number; month0: number; isCurrent: boolean }[];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month0: d.getMonth(), isCurrent: i === 0 });
  }

  const txns: NewTransaction[] = [];
  const creditExpenseByMonth = new Array(months.length).fill(0);

  type AddOpts = {
    toAccountKey?: AccountKey;
    category?: string;
    payee?: string;
    description?: string;
    rewardPoints?: number;
  };

  months.forEach((m, idx) => {
    const dim = daysInMonth(m.year, m.month0);
    const maxDay = m.isCurrent ? today.getDate() : dim;

    const add = (day: number, type: "income" | "expense" | "transfer", amount: number, accountKey: AccountKey, opts: AddOpts = {}) => {
      if (day > maxDay || day < 1) return;
      const amt = round2(amount);
      if (accountKey === "credit" && type === "expense") creditExpenseByMonth[idx] += amt;
      txns.push({
        userId,
        date: iso(m.year, m.month0, day),
        type,
        amount: amt.toFixed(2),
        accountId: accountId[accountKey],
        toAccountId: opts.toAccountKey ? accountId[opts.toAccountKey] : null,
        categoryId: opts.category ? categoryId[opts.category] : null,
        payeeId: opts.payee ? payeeId[opts.payee] : null,
        description: opts.description ?? null,
        rewardPoints: opts.rewardPoints != null ? opts.rewardPoints.toFixed(2) : null,
      });
    };

    add(1, "income", 82000 + rnd(-1500, 3500), "checking", { category: "Salary", payee: "Acme Corp", description: "Monthly salary" });
    if (idx % 2 === 0) {
      add(rnd(14, 18), "income", rnd(12000, 24000), "checking", { category: "Freelance Income", payee: "Nimbus Design Studio", description: "Freelance project payment" });
    }
    add(3, "expense", 22000, "checking", { category: "Rent", payee: "Shalini Mehta", description: "Monthly rent" });
    add(7, "expense", rnd(1400, 3200), "checking", { category: "Utilities", payee: "State Electricity Board", description: "Electricity bill" });
    add(10, "expense", 999, "credit", { category: "Utilities", payee: "Airtel", description: "Broadband + mobile bill", rewardPoints: 20 });

    for (let g = 0; g < 3; g++) {
      add(rnd(2, 27), "expense", rnd(1200, 3800), pick<AccountKey>(["checking", "cash"]), { category: "Groceries", payee: "BigBasket", description: "Grocery shopping" });
    }

    const diningCount = rnd(3, 5);
    for (let d0 = 0; d0 < diningCount; d0++) {
      const amt = rnd(350, 1400);
      add(rnd(1, 28), "expense", amt, "credit", { category: "Dining Out", payee: "Swiggy", description: "Food delivery", rewardPoints: round2(amt * 0.02) });
    }

    const rideCount = rnd(4, 7);
    for (let r = 0; r < rideCount; r++) {
      add(rnd(1, 28), "expense", rnd(150, 650), pick<AccountKey>(["cash", "credit"]), { category: "Transport", payee: "Uber", description: "Cab ride" });
    }
    add(rnd(5, 25), "expense", rnd(2200, 3600), "cash", { category: "Fuel", payee: "Indian Oil", description: "Fuel refill" });

    add(12, "expense", 649, "credit", { category: "Entertainment", payee: "Netflix", description: "Netflix subscription", rewardPoints: 13 });

    const shopCount = rnd(1, 3);
    for (let s = 0; s < shopCount; s++) {
      const amt = rnd(800, 6500);
      add(rnd(1, 28), "expense", amt, "credit", { category: "Shopping", payee: "Amazon", description: "Online shopping", rewardPoints: round2(amt * 0.015) });
    }

    if (Math.random() < 0.4) {
      add(rnd(1, 28), "expense", rnd(400, 2600), pick<AccountKey>(["checking", "cash"]), { category: "Healthcare", payee: "Apollo Pharmacy", description: "Pharmacy / clinic visit" });
    }

    if ([1, 5, 9].includes(idx)) {
      const amt = rnd(15000, 42000);
      add(rnd(8, 20), "expense", amt, "credit", { category: "Travel", payee: "MakeMyTrip", description: "Trip booking", rewardPoints: round2(amt * 0.02) });
    }

    if (idx % 3 === 0) {
      add(rnd(15, 25), "expense", 5400, "checking", { category: "Insurance", payee: "LIC Insurance", description: "Insurance premium" });
    }

    if (Math.random() < 0.25) {
      add(rnd(1, 28), "expense", rnd(500, 2500), "checking", { category: "Gifts & Donations", payee: "Local Charity Trust", description: "Donation" });
    }

    if (idx % 3 === 2) {
      add(20, "income", rnd(500, 2200), "investment", { category: "Investments", description: "Dividend payout" });
    }
    if (idx === 3) {
      add(rnd(1, 15), "income", rnd(4000, 7000), "ppf", { category: "Investments", description: "PPF interest credited" });
    }

    add(6, "transfer", rnd(14000, 22000), "checking", { toAccountKey: "savings", description: "Monthly savings transfer" });
    add(8, "transfer", 10000, "checking", { toAccountKey: "investment", description: "Mutual fund SIP" });
    add(9, "transfer", 12500, "checking", { toAccountKey: "ppf", description: "PPF contribution" });
    add(rnd(1, 4), "transfer", rnd(6000, 9000), "checking", { toAccountKey: "cash", description: "ATM cash withdrawal" });

    if (idx > 0 && creditExpenseByMonth[idx - 1] > 0) {
      add(24, "transfer", creditExpenseByMonth[idx - 1], "checking", { toAccountKey: "credit", description: "Credit card bill payment" });
    }
  });

  console.log(`Inserting ${txns.length} transactions...`);
  for (const batch of chunk(txns, 100)) {
    await db.insert(transactions).values(batch);
  }

  console.log("Adding reward bonuses and a redemption on the credit card...");
  const firstMonth = months[0];
  const midMonth = months[6];
  const redeemMonth = months[9];
  await db.insert(rewardBonuses).values([
    {
      userId,
      accountId: accountId.credit,
      points: "2500",
      description: "Card signup bonus",
      date: iso(firstMonth.year, firstMonth.month0, 2),
    },
    {
      userId,
      accountId: accountId.credit,
      points: "1800",
      description: "Quarterly spend milestone bonus",
      date: iso(midMonth.year, midMonth.month0, 15),
    },
  ]);
  await db.insert(rewardRedemptions).values({
    userId,
    accountId: accountId.credit,
    points: "3000",
    description: "Redeemed for Amazon gift voucher",
    date: iso(redeemMonth.year, redeemMonth.month0, 18),
  });

  console.log("Recalculating account balances...");
  await recalcAllBalances(userId);

  console.log("\nDemo data seeded.");
  console.log(`Login: /login`);
  console.log(`Email: ${EMAIL}`);
  console.log(`Password: ${PASSWORD}`);
  console.log(`Accounts: ${accountRows.length}, Categories: ${categoryRows.length}, Payees: ${payeeRows.length}, Transactions: ${txns.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Demo data seed failed:", err);
    process.exit(1);
  });
