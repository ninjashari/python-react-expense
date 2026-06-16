# Expense Manager — Next.js Rewrite: Success Criteria

Single Next.js (App Router, TS) app. Postgres (Neon) + Drizzle. Tailwind + shadcn/ui. No AI. Core-first.

## Definition of Done (loop until all checked)

### Foundation
- [x] Next.js 15 App Router + TypeScript scaffolded at repo root
- [x] Tailwind + shadcn/ui configured, dark/light theme
- [x] Drizzle ORM + Neon Postgres; schema + migrations
- [x] `.env.example`, README updated, render.yaml updated for single service
- [x] `npm run build` passes; `npm run lint` clean; `tsc` no errors

### Auth (secure)
- [x] Register, login, logout, change password
- [x] Passwords hashed (bcrypt), JWT in httpOnly+secure+sameSite cookie
- [x] All data routes scoped to current user (no IDOR)
- [x] Zod validation on every input; rate-limit on auth

### Core domain
- [x] Accounts: CRUD, types (checking/savings/credit/cash/investment/ppf), balances, credit-card fields, recalc
- [x] Transactions: CRUD, income/expense/transfer, pagination, filter/sort, running balance, summary
- [x] Categories: CRUD, color, slug, unused cleanup
- [x] Payees: CRUD, color, slug, unused cleanup
- [x] Dashboard: total balance, recent txns, spending breakdown
- [x] Reports: by-category, by-payee, monthly trend (charts)

### Quality gates
- [x] Security review pass (no secrets, no SQLi, authz enforced, headers set)
- [x] Efficient: indexed queries, server components, no N+1, paginated lists
- [x] Responsive, accessible, modern UX
- [x] Builds and runs locally; smoke-tested

## Later iterations (post-core)
- Reward points + bonuses + redemptions, history
- CSV/Excel import
- Backup/export
