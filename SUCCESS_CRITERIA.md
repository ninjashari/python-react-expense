# Expense Manager — Next.js Rewrite: Success Criteria

Single Next.js (App Router, TS) app. Postgres (Neon) + Drizzle. Tailwind + shadcn/ui. No AI. Core-first.

## Definition of Done (loop until all checked)

### Foundation
- [ ] Next.js 15 App Router + TypeScript scaffolded at repo root
- [ ] Tailwind + shadcn/ui configured, dark/light theme
- [ ] Drizzle ORM + Neon Postgres; schema + migrations
- [ ] `.env.example`, README updated, render.yaml updated for single service
- [ ] `npm run build` passes; `npm run lint` clean; `tsc` no errors

### Auth (secure)
- [ ] Register, login, logout, change password
- [ ] Passwords hashed (bcrypt), JWT in httpOnly+secure+sameSite cookie
- [ ] All data routes scoped to current user (no IDOR)
- [ ] Zod validation on every input; rate-limit on auth

### Core domain
- [ ] Accounts: CRUD, types (checking/savings/credit/cash/investment/ppf), balances, credit-card fields, recalc
- [ ] Transactions: CRUD, income/expense/transfer, pagination, filter/sort, running balance, summary
- [ ] Categories: CRUD, color, slug, unused cleanup
- [ ] Payees: CRUD, color, slug, unused cleanup
- [ ] Dashboard: total balance, recent txns, spending breakdown
- [ ] Reports: by-category, by-payee, monthly trend (charts)

### Quality gates
- [ ] Security review pass (no secrets, no SQLi, authz enforced, headers set)
- [ ] Efficient: indexed queries, server components, no N+1, paginated lists
- [ ] Responsive, accessible, modern UX
- [ ] Builds and runs locally; smoke-tested

## Later iterations (post-core)
- Reward points + bonuses + redemptions, history
- CSV/Excel import
- Backup/export
