# Certificates (Passport credential ledger)

A personal credential ledger in the browser: three sample credentials to start with, search by title, issuer or
year, filter by Verified / In progress / Expired, add a record, toggle verified, copy a record as text and remove
one. Your ledger is saved in this browser's localStorage only.

Live: https://certs.bookchaowalit.com (deployed by Vercel CLI; it can lag `main`, see `PRODUCT.md`).

## What it does not do

- No verification: "Verified" is a label you set yourself. No issuer API, verification URLs, PDF copies or
  employer checks. No account or sync; clearing site data clears the ledger.

## Run

```bash
npm ci
npm run dev
```

## Checks

```bash
npm test           # Vitest: ledger logic, localStorage store, MCP route, home page render, Sentry scrubbing
npm run lint
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) runs the shared Node workflow (lint, typecheck, tests with a line-coverage gate,
build) and the shared security scan on every push and PR to `main`.

## Code map

- `lib/certs.ts`: the sample credentials plus parse/serialize (with shape validation), filter, add, toggle, remove
  and copy-text helpers (used by the page and the MCP route).
- `lib/ledger-store.ts`: the localStorage-backed store (`useSyncExternalStore`: samples on the server and during
  hydration, then the saved ledger; follows changes from other tabs; falls back to memory when storage is blocked).
- `app/api/mcp/route.ts`: stateless JSON-RPC endpoint with `get_all`, `get_by_id` and `search` over the sample
  credentials only (a visitor's ledger never leaves their browser).
- `lib/sentry.ts` + `instrumentation*.ts`: error reporting to Sentry, errors only, personal data stripped; off when
  `NEXT_PUBLIC_SENTRY_DSN` is unset.
- `app/more-projects/page.tsx`: shared portfolio link page (copied per repository, not a package).
