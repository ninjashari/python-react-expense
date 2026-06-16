# Ledgerly — Expense Manager

A fast, modern personal finance manager built as a **single Next.js application**
(App Router) with the backend (API route handlers) and frontend in one codebase.

> Rewritten from scratch from the original Python (FastAPI) + React app into a
> unified, type-safe, efficient Next.js stack.

## Stack

| Layer      | Choice                                             |
| ---------- | -------------------------------------------------- |
| Framework  | Next.js 16 (App Router, RSC) + TypeScript          |
| UI         | Tailwind CSS v4 + shadcn/ui + Recharts             |
| Database   | Neon Postgres                                      |
| ORM        | Drizzle ORM                                        |
| Auth       | JWT sessions (jose) in httpOnly cookies, bcrypt    |
| Validation | Zod                                                |

## Features (core)

- **Auth** — register, login, logout, change password; user-scoped data.
- **Accounts** — checking, savings, credit, cash, investment, PPF; balances,
  credit-card details, balance recalculation.
- **Transactions** — income / expense / transfer, filtering, search, pagination,
  sorting, automatic balance maintenance.
- **Categories & Payees** — colored taxonomies with usage counts.
- **Dashboard** — total balance, monthly income/expense/net, recent activity,
  spending-by-category donut.
- **Reports** — by category, by payee, monthly income-vs-expense trend.

## Getting started

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env   # then set DATABASE_URL (Neon) and AUTH_SECRET

# 3. Apply the schema to your database
npm run db:migrate     # or: npm run db:push

# 4. Run
npm run dev            # http://localhost:3000
```

### Environment variables

| Variable       | Description                                          |
| -------------- | ---------------------------------------------------- |
| `DATABASE_URL` | Neon Postgres pooled connection string.              |
| `AUTH_SECRET`  | ≥32-char secret for signing session JWTs.            |

## Scripts

| Script              | Purpose                          |
| ------------------- | -------------------------------- |
| `npm run dev`       | Start the dev server             |
| `npm run build`     | Production build                 |
| `npm run start`     | Start the production server      |
| `npm run lint`      | ESLint                           |
| `npm run typecheck` | TypeScript check                 |
| `npm run db:generate` | Generate a Drizzle migration   |
| `npm run db:migrate`  | Apply migrations               |
| `npm run db:push`     | Push schema (dev)              |
| `npm run db:studio`   | Drizzle Studio                 |

## Deployment (Render)

`render.yaml` defines a single Node web service. Set `DATABASE_URL` (Neon) in the
Render dashboard; `AUTH_SECRET` is generated automatically. Migrations run during
the build step.

## Project structure

```
src/
  app/
    (auth)/            # login / register
    (app)/             # authenticated shell + pages
    api/               # route handlers (REST-ish JSON API)
  components/
    ui/                # shadcn/ui primitives
    app/ charts/ auth/ # feature components
  db/                  # Drizzle schema + client
  lib/                 # auth, validation, http, balance, utils
  proxy.ts             # auth route protection (Next "proxy")
```
