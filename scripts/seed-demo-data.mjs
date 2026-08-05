#!/usr/bin/env node
// Seeds a demo account with a year of realistic dummy data against a running
// instance of the Ledgerly Next.js app (claude/nextjs-rewrite), using its
// public HTTP API. Safe to point at a live deployment.
//
// Usage:
//   BASE_URL=https://ledgerly-kaqh.onrender.com node scripts/seed-demo-data.mjs
//
// Optional env vars: DEMO_EMAIL, DEMO_PASSWORD, DEMO_NAME.
// Re-running is mostly safe: registration/categories/payees fall back to the
// existing record on a 409, but re-running will add a second copy of the
// accounts and transactions, so only run it once per target.

const BASE_URL = (process.env.BASE_URL || "https://ledgerly-kaqh.onrender.com").replace(/\/$/, "");
const EMAIL = process.env.DEMO_EMAIL || "demo@ledgerly.app";
const PASSWORD = process.env.DEMO_PASSWORD || "DemoLedger#2026";
const NAME = process.env.DEMO_NAME || "Demo User";

let cookie = "";

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ??
    (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
  if (setCookie.length) cookie = setCookie.map((c) => c.split(";")[0]).join("; ");

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
function rnd(min, max) {
  return Math.round(min + Math.random() * (max - min));
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function daysInMonth(y, m0) {
  return new Date(y, m0 + 1, 0).getDate();
}
function iso(y, m0, d) {
  return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

async function registerOrLogin() {
  let r = await api("POST", "/api/auth/register", { name: NAME, email: EMAIL, password: PASSWORD });
  if (r.ok) {
    console.log(`Registered demo user ${EMAIL}`);
    return;
  }
  if (r.status === 409) {
    console.log("Demo user already exists, logging in instead...");
    r = await api("POST", "/api/auth/login", { email: EMAIL, password: PASSWORD });
    if (!r.ok) throw new Error(`Login failed: ${JSON.stringify(r.data)}`);
    return;
  }
  throw new Error(`Register failed (${r.status}): ${JSON.stringify(r.data)}`);
}

async function ensureTaxonomy(path, name, color) {
  let r = await api("POST", path, { name, color });
  if (r.ok) return r.data.id;
  if (r.status === 409) {
    const list = await api("GET", `${path}?search=${encodeURIComponent(name)}`);
    const match = Array.isArray(list.data) ? list.data.find((x) => x.name === name) : null;
    if (match) return match.id;
  }
  throw new Error(`Failed to create ${path} "${name}" (${r.status}): ${JSON.stringify(r.data)}`);
}

async function createAccount(payload) {
  const r = await api("POST", "/api/accounts", payload);
  if (!r.ok) throw new Error(`Failed to create account "${payload.name}" (${r.status}): ${JSON.stringify(r.data)}`);
  return r.data.id;
}

async function createTransaction(payload) {
  const r = await api("POST", "/api/transactions", payload);
  if (!r.ok) throw new Error(`Failed to create transaction (${r.status}): ${JSON.stringify(r.data)} ${JSON.stringify(payload)}`);
  return r.data;
}

const CATEGORIES = [
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

const PAYEES = [
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

async function main() {
  console.log(`Seeding demo data into ${BASE_URL} ...`);
  await registerOrLogin();

  console.log("Creating categories...");
  const categoryId = {};
  for (const [name, color] of CATEGORIES) categoryId[name] = await ensureTaxonomy("/api/categories", name, color);

  console.log("Creating payees...");
  const payeeId = {};
  for (const [name, color] of PAYEES) payeeId[name] = await ensureTaxonomy("/api/payees", name, color);

  console.log("Creating accounts...");
  const today = new Date();
  const thirteenMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 13, 1);
  const openingDate = iso(thirteenMonthsAgo.getFullYear(), thirteenMonthsAgo.getMonth(), 1);

  const accountId = {};
  accountId.checking = await createAccount({
    name: "HDFC Salary Account",
    type: "checking",
    balance: 45000,
    accountNumber: "50100234567890",
    status: "active",
    openingDate,
    currency: "INR",
  });
  accountId.savings = await createAccount({
    name: "ICICI Savings",
    type: "savings",
    balance: 120000,
    accountNumber: "029401123456",
    interestRate: 3.5,
    status: "active",
    openingDate,
    currency: "INR",
  });
  accountId.credit = await createAccount({
    name: "Ledgerly Rewards Visa",
    type: "credit",
    balance: 0,
    cardNumber: "4821",
    cardExpiryMonth: 11,
    cardExpiryYear: 2029,
    creditLimit: 200000,
    billGenerationDate: 5,
    paymentDueDate: 25,
    interestRate: 3.49,
    status: "active",
    openingDate,
    currency: "INR",
  });
  accountId.cash = await createAccount({
    name: "Cash Wallet",
    type: "cash",
    balance: 3000,
    status: "active",
    openingDate,
    currency: "INR",
  });
  accountId.investment = await createAccount({
    name: "Zerodha Direct Equity",
    type: "investment",
    balance: 50000,
    status: "active",
    openingDate,
    currency: "INR",
  });
  accountId.ppf = await createAccount({
    name: "PPF Account",
    type: "ppf",
    balance: 80000,
    interestRate: 7.1,
    status: "active",
    openingDate,
    currency: "INR",
  });

  console.log("Generating 12 months of transactions...");
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month0: d.getMonth(), isCurrent: i === 0 });
  }

  const txns = [];
  const creditExpenseByMonth = new Array(months.length).fill(0);

  months.forEach((m, idx) => {
    const dim = daysInMonth(m.year, m.month0);
    const maxDay = m.isCurrent ? today.getDate() : dim;

    const add = (day, type, amount, accountKey, opts = {}) => {
      if (day > maxDay || day < 1) return;
      amount = round2(amount);
      if (accountKey === "credit" && type === "expense") creditExpenseByMonth[idx] += amount;
      txns.push({
        date: iso(m.year, m.month0, day),
        type,
        amount,
        accountId: accountId[accountKey],
        toAccountId: opts.toAccountKey ? accountId[opts.toAccountKey] : undefined,
        categoryId: opts.category ? categoryId[opts.category] : undefined,
        payeeId: opts.payee ? payeeId[opts.payee] : undefined,
        description: opts.description,
        rewardPoints: opts.rewardPoints,
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
      add(rnd(2, 27), "expense", rnd(1200, 3800), pick(["checking", "cash"]), { category: "Groceries", payee: "BigBasket", description: "Grocery shopping" });
    }

    const diningCount = rnd(3, 5);
    for (let d0 = 0; d0 < diningCount; d0++) {
      const amt = rnd(350, 1400);
      add(rnd(1, 28), "expense", amt, "credit", { category: "Dining Out", payee: "Swiggy", description: "Food delivery", rewardPoints: round2(amt * 0.02) });
    }

    const rideCount = rnd(4, 7);
    for (let r = 0; r < rideCount; r++) {
      add(rnd(1, 28), "expense", rnd(150, 650), pick(["cash", "credit"]), { category: "Transport", payee: "Uber", description: "Cab ride" });
    }
    add(rnd(5, 25), "expense", rnd(2200, 3600), "cash", { category: "Fuel", payee: "Indian Oil", description: "Fuel refill" });

    add(12, "expense", 649, "credit", { category: "Entertainment", payee: "Netflix", description: "Netflix subscription", rewardPoints: 13 });

    const shopCount = rnd(1, 3);
    for (let s = 0; s < shopCount; s++) {
      const amt = rnd(800, 6500);
      add(rnd(1, 28), "expense", amt, "credit", { category: "Shopping", payee: "Amazon", description: "Online shopping", rewardPoints: round2(amt * 0.015) });
    }

    if (Math.random() < 0.4) {
      add(rnd(1, 28), "expense", rnd(400, 2600), pick(["checking", "cash"]), { category: "Healthcare", payee: "Apollo Pharmacy", description: "Pharmacy / clinic visit" });
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

    if (idx > 0 && creditExpenseByMonth[idx - 1] > 0) {
      add(24, "transfer", creditExpenseByMonth[idx - 1], "checking", { toAccountKey: "credit", description: "Credit card bill payment" });
    }
  });

  console.log(`Posting ${txns.length} transactions (this can take a couple of minutes)...`);
  let done = 0;
  for (const t of txns) {
    await createTransaction(t);
    done += 1;
    if (done % 25 === 0) console.log(`  ${done}/${txns.length}`);
  }

  console.log("Adding reward bonuses and a redemption on the credit card...");
  const firstMonth = months[0];
  await api("POST", `/api/accounts/${accountId.credit}/bonuses`, {
    points: 2500,
    description: "Card signup bonus",
    date: iso(firstMonth.year, firstMonth.month0, 2),
  });
  const midMonth = months[6];
  await api("POST", `/api/accounts/${accountId.credit}/bonuses`, {
    points: 1800,
    description: "Quarterly spend milestone bonus",
    date: iso(midMonth.year, midMonth.month0, 15),
  });
  const redeemMonth = months[9];
  await api("POST", `/api/accounts/${accountId.credit}/redemptions`, {
    points: 3000,
    description: "Redeemed for Amazon gift voucher",
    date: iso(redeemMonth.year, redeemMonth.month0, 18),
  });

  console.log("\nDone.");
  console.log(`Login: ${BASE_URL}/login`);
  console.log(`Email: ${EMAIL}`);
  console.log(`Password: ${PASSWORD}`);
  console.log(`Accounts: ${Object.keys(accountId).length}, Categories: ${CATEGORIES.length}, Payees: ${PAYEES.length}, Transactions: ${txns.length}`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
