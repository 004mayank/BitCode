# BitCode

AI-native developer platform (monorepo) — MVP scaffold.

## Apps

- `apps/web` — Next.js (App Router) product UI
- `apps/api` — Express API (SSE for evaluations)

## Packages

- `packages/db` — Prisma schema + DB client
- `packages/shared` — shared types + Zod schemas + scoring utils

## Quick start

### 1) Install

```bash
pnpm install
```

### 2) Configure env

Copy env templates and fill values:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp packages/db/.env.example packages/db/.env
```

### 3) DB migrate + seed

```bash
pnpm db:migrate
pnpm seed
```

### 4) Run dev

```bash
pnpm dev
```

Web: http://localhost:3000

API: http://localhost:8000

## Notes

This scaffold focuses on BitCode’s key differentiator: capturing AI-workflow telemetry (prompt + iteration events) and producing an explainable score breakdown.

