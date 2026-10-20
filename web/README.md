# HMRC VAT & ITSA connection UI

Next.js app for accountants and clients to connect a client to HMRC, review token status, disconnect, and fetch VAT or ITSA obligations.

## Pages

| Path | Purpose |
| --- | --- |
| `/login` | Practice login (JWT stored in `sessionStorage` only) |
| `/` | Hub for VAT and ITSA |
| `/vat` | VAT connection dashboard, expiry countdown, connect / refresh / disconnect |
| `/itsa` | ITSA connection dashboard, expiry countdown, connect / refresh / disconnect |
| `/vat/connect` · `/itsa/connect` | Starts `GET /hmrc/oauth/start` and redirects to HMRC |
| `/vat/callback` · `/itsa/callback` | Handles `code` + `state` after a local mock grant |
| `/hmrc/callback` | Shared live HMRC redirect; returns to the regime that started the grant |
| `/vat/obligations` | `GET /vat/obligations` |
| `/itsa/obligations` | `GET /itsa/obligations` |
| `/itsa/quarterly-update` | Ledger preview and `POST /itsa/quarterly-update` |
| `/vat/returns/prepare` | Ledger preview for the selected VAT period |

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
