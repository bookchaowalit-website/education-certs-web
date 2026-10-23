# Certificates — Product truth

> Inferred from the code and copy (no user interview). Checked against the portfolio card claims review
> (`portfolio-site-web/docs/audits/CARD-CLAIMS-REVIEW-2026-10.md`, row `certs`, evidence Live→Prototype) on 2026-10-23.

## What it is

A single-user, browser-only credential ledger ("passport") that starts with three sample credentials.

## Who it is for

Someone who wants a private list of their certifications and study paths, and a portfolio visitor looking at a
small, careful form-and-list UI.

## What works today

1. Search title, issuer or year (case-insensitive) and filter by All, Verified, In progress or Expired.
2. Add a record (title and issuer required), toggle Verified / In progress, copy a record as text, remove a record.
3. The ledger is saved in this browser's localStorage (`certs-v2`) and survives a reload; corrupt saved data falls
   back to the samples instead of breaking the page.
4. `/api/mcp` answers JSON-RPC with `get_all`, `get_by_id` and `search` over the three sample credentials, echoes the
   request id, and returns JSON-RPC errors for unknown tools, unknown methods and bad JSON.
5. Front-end and server errors go to Sentry (errors only, personal data stripped) when `NEXT_PUBLIC_SENTRY_DSN` is set.

## What does not work (and must not be claimed)

- No unique verification URLs, downloadable PDF copies or instant employer verification (claimed by the card;
  removed in the 2026-10 review). "Verified" is the user's own label, not a check against any issuer.
- No account, sync, export or sharing. The MCP route cannot see a visitor's ledger.
- The old `data/certifications.json` was never used and has been removed.

## Live URL and deploy state

- Live: https://certs.bookchaowalit.com (HTTP 200 on 2026-10-23).
- The Vercel project `bookchaowalit-certs-frontend` is deployed only by CLI. The last production deploy is
  2026-10-08 (CLI, commit f473e66): the CVE patch deploy did not run because the Vercel free-plan daily deploy limit
  was hit on 2026-10-23. Its Git link names the old repository (`bookchaowalit/bookchaowalit-certs-frontend`), so a
  push to `main` does not deploy: the CVE patch and the L2 commits stay undeployed until the coordinator redeploys
  or the owner reconnects Vercel Git to this repository (owner action D9). Until then the live `/api/mcp` still
  answers id 0 and "Tool called: <name>" for any tool.
- `NEXT_PUBLIC_SENTRY_DSN` is set on the Vercel project (Sentry project `education-certs-web`, org `personal-yu0`).

## Boundaries

- Browser-only apart from the stateless `/api/mcp` route. No personal data reaches the server.
