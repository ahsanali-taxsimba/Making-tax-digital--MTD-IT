# HMRC VAT connection UI

Next.js app for accountants and clients to connect a VAT client to HMRC, review token status, disconnect, and fetch VAT obligations.

## Pages

| Path | Purpose |
| --- | --- |
| `/login` | Practice login (JWT stored in `sessionStorage` only) |
| `/vat` | Connection dashboard, expiry countdown, connect / refresh / disconnect |
| `/vat/connect` | Starts `GET /hmrc/oauth/start` and redirects to HMRC |
| `/vat/callback` | Handles `code` + `state` and calls `GET /hmrc/oauth/callback` |
| `/vat/obligations` | `GET /vat/obligations` |
| `/vat/returns/prepare` | Ledger preview for the selected period |

HMRC access and refresh tokens never leave the API. The browser only keeps the practice JWT and a temporary OAuth `code`/`state` on the callback URL.

## Local run

```bash
cp web/.env.local.example web/.env.local
npm --prefix web install
npm --prefix web run dev
```

UI: http://localhost:2327  
API: http://localhost:3000 (`FRONTEND_ORIGIN=http://localhost:2327`)

Seed login: `marco.r@example.org` / `PracticeAdmin123!`

In `HMRC_MODE=mock` (or `NEXT_PUBLIC_HMRC_MOCK=true`) Connect completes locally so you can exercise the callback without a real HMRC grant.
