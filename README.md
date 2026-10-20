# Making Tax Digital IT

A multi-tenant SaaS backend for UK accountancy firms and their clients. It covers Making Tax Digital for VAT and Making Tax Digital for Income Tax (ITSA), with a clean extension point for Corporation Tax and third-party ledgers such as Xero or QuickBooks.

## Stack choice

NestJS is the application framework because it gives modular boundaries, first-class DI, guards, interceptors, and OpenAPI out of the box — the same shape as a production practice platform. PostgreSQL is the system of record for tenancy, obligations, submissions, and audit. Prisma keeps the schema, migrations, and TypeScript types in one place. JWT access/refresh tokens secure the practice API; HMRC user-restricted OAuth is isolated behind gateway interfaces so sandbox and live can be swapped without touching domain services. HMRC access and refresh tokens are encrypted at rest with AES-256-GCM.

## Architecture

Role routing, module boundaries, and tenant isolation are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Defence-in-depth (edge, identity, MFA, tenant isolation, audit, metrics, backup) is in [docs/SECURITY.md](docs/SECURITY.md). `GET /metrics` is the Prometheus scrape. Privileged logins take TOTP when `MFA_ENFORCE=true`.

```
controllers  →  VAT / ITSA / OAuth modules  →  repositories / Prisma
                            ↓
                   HmrcClientService
                     get · post · getValidAccessToken
                     handleTokenRefresh · handleHMRCError
                            ↓
              OAuth tokens (AES-256-GCM)  +  HMRC HTTP (mock | live)
                            ↓
         tasks · notifications · webhooks · AuditLog
```

- **Tenancy:** every user belongs to a firm. Accountants see firm clients; client-portal users only see their linked client.
- **RBAC:** `ADMIN`, `ACCOUNTANT`, `ASSISTANT`, `CLIENT`.
- **HMRC client:** VAT and ITSA never call HMRC directly. `HmrcClientService` is the single HTTP client: it loads a valid access token, refreshes on expiry, retries once after 401, and maps failures onto `HMRC_ERR_*`.
- **HMRC OAuth:** dedicated `/hmrc/oauth/*` module for start, callback, status, disconnect, encrypted tokens, per-environment app config, and `getValidAccessToken()`. Automatic refresh runs on demand and in the background.
- **Envelope:** `{ data, error }` on every response.
- **Charts of accounts:** landlord, sole trader, and company templates are provisioned when a client is created. Extra profiles can be applied later (for example a sole trader who also lets property).
- **ITSA engine:** quarterly updates, EOPS, and Final Declaration go through a coded validator (period, category, capital exclusion, zero-update, missing EOPS/FD). Public routes live at `/itsa/*`; client-scoped aliases remain at `/clients/:id/itsa/*`.
- **VAT engine:** HMRC obligations, returns, payments, and OAuth sit behind a Notice 700/12 validator. Boxes 1–9 are rolled from the ledger, checked with coded errors (`VAT_ERR_ARITHMETIC`, `VAT_ERR_PERIOD_MISMATCH`, …), and submitted only when valid. Public routes live at `/vat/*`; client-scoped aliases remain at `/clients/:id/vat/*`.
- **Bookkeeping engine:** double-entry journals, sales invoices, purchase bills, bank feeds, and period-locked reports. VAT boxes 1/4/6/7 and ITSA category totals are rolled from posted journals for the MTD engines. Public routes live at `/bookkeeping/*`.
- **Yapily Open Banking:** `/yapily/consent/*` starts and stores an encrypted bank-feed consent. `/yapily/accounts` syncs accounts, transactions, and balances into `BankAccount` / `BankTransaction`. `POST /yapily/transactions/sync` runs the full pipeline: enrich → invoice/bill match → auto-categorise → reconciliation session → optional journal posting → VAT boxes 1/4/6/7 and ITSA totals. `YAPILY_MODE=mock` returns canned Starling-style feeds.
- **Invoice/bill matching:** `GET /matching/suggestions` scores unmatched bank lines against sales invoices and purchase bills (amount, £1–£2 tolerance, ±7 day window, merchant similarity, invoice reference, recurring payments, MCC). `POST /matching/apply` posts a bank settlement journal (debtors or creditors) and marks the line matched; `POST /matching/reject` keeps the line unmatched.

## Local development

### With Docker

```bash
cp .env.example .env
docker compose up --build
```

API: http://localhost:3000  
OpenAPI: http://localhost:3000/docs  
Health: http://localhost:3000/health  
VAT & ITSA UI: http://localhost:2327

### Without Docker (API process only)

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
npm run web:dev
```

VAT and ITSA connection UI: http://localhost:2327 (`/vat`, `/itsa`, `/hmrc/callback`). Client portal: `/portal`. Practice management: `/practice` (staff, clients, task board, HMRC connections). Bank feeds: `/reconciliation`, `/categorisation`, `/matching`. The browser never sees HMRC tokens. One HMRC grant covers both regimes.

### Seed users

| Role | Email | Password |
| --- | --- | --- |
| Firm admin | marco.r@example.org | PracticeAdmin123! |
| Accountant | carol.w@example.org | PracticeAdmin123! |
| Assistant | wendy.h@example.net | PracticeAdmin123! |
| Client portal | tom.h@example.org | PracticeAdmin123! |

`HMRC_MODE=mock` is the default. `HmrcClientService` then returns canned VAT/ITSA obligations and accepts submissions so the full accountant workflow can be exercised without HMRC credentials. `HMRC_MODE=sandbox` calls the real HMRC sandbox (`https://test-api.service.hmrc.gov.uk`) for OAuth, VAT, and ITSA. `HMRC_MODE=live` uses production HMRC hosts when `HMRC_ENVIRONMENT=live`. The API Gateway injects `x-mtd-hmrc-sandbox`, `x-mtd-hmrc-mode`, and `x-mtd-hmrc-environment` on every response. `sandbox=true` (query, JSON body, `x-mtd-hmrc-sandbox`, or `HMRC_SANDBOX=true`) forces every HMRC call onto test-api hosts. `GET /hmrc/environment` and `POST /hmrc/environment` `{ "sandbox": true }` switch sandbox vs live. The practice UI sends those headers from the Client picker. Authenticated browser calls also send `x-mtd-fraud-prevention` (device, timezone, screens, window, UA). The API overwrites `Gov-Client-Public-IP` from `X-Forwarded-For`. VAT and ITSA submit require a document, bank transaction, and journal in the period (`DIGITAL_LINKS_ENFORCE`). Connected clients are obligation-synced in-process (`HMRC_OBLIGATION_SYNC_MS`) with due-date notices (`HMRC_OBLIGATION_DUE_DAYS`).

`YAPILY_MODE=mock` is the default for Open Banking. `POST /yapily/consent/start` returns a mock authorisation URL; after the callback the consent token is encrypted at rest and never returned to the browser. `GET /yapily/accounts` upserts bank accounts, `GET /yapily/accounts/:id/transactions` enriches merchant/category fields and can `autoPost=true` to match invoices/bills or post bank-feed journals, and `GET /yapily/accounts/:id/balance` updates `BankAccount.balance`. Unmatched lines stay available to `POST /bookkeeping/bank/accounts/:id/reconcile`.

### Shared HMRC errors

Every HMRC failure is returned as `{ data: null, error: { errorCode, message, details? } }` with one of:

`HMRC_ERR_TOKEN_EXPIRED` · `HMRC_ERR_TOKEN_REFRESH_FAILED` · `HMRC_ERR_UNAUTHORISED` · `HMRC_ERR_INVALID_SCOPE` · `HMRC_ERR_FORBIDDEN` · `HMRC_ERR_NOT_FOUND` · `HMRC_ERR_CONFLICT` · `HMRC_ERR_RATE_LIMIT` · `HMRC_ERR_SERVER` · `HMRC_ERR_BAD_REQUEST` · `HMRC_ERR_CONNECTION`

## Connect to the HMRC sandbox

1. Create an application on the [HMRC Developer Hub](https://developer.service.hmrc.gov.uk/).
2. Subscribe to **VAT (MTD)**, **Obligations (MTD)**, **Self Employment Business**, **Property Business**, **Individuals Business End of Period Statement**, and **Individual Calculations**.
3. Add redirect URI `http://localhost:2327/hmrc/callback` (the API still accepts `/hmrc/oauth/callback` and the legacy `/mtd/callback` alias).
4. Put the client id/secret in `.env` and set:

```env
HMRC_MODE=sandbox
HMRC_ENVIRONMENT=sandbox
HMRC_SANDBOX_CLIENT_ID=...
HMRC_SANDBOX_CLIENT_SECRET=...
HMRC_SANDBOX_REDIRECT_URI=http://localhost:2327/hmrc/callback
HMRC_SANDBOX_BASE_URL=https://test-api.service.hmrc.gov.uk
HMRC_SANDBOX_AUTHORIZE_URL=https://test-api.service.hmrc.gov.uk/oauth/authorize
```

5. Create a sandbox organisation (VAT) and individual (ITSA) test user:
   `POST /hmrc/sandbox/test-users` with `{ "type": "organisation" }` or `{ "type": "individual" }`, or load credentials from `HMRC_SANDBOX_TEST_USERS_FILE`.
6. `POST /hmrc/sandbox/test-users/:id/login` with `{ "clientId": "..." }` returns the grant URL plus the test-user password. Complete the HMRC grant screen.
7. Fetch VAT obligations (`GET /vat/obligations`) or ITSA obligations (`GET /itsa/obligations`), create a VAT draft (`POST /vat/returns/draft`), then submit (`POST /vat/returns/submit`). ITSA: `PUT /itsa/uk-property/periodic`, `PUT /itsa/uk-property/eops`, `POST /itsa/final-declaration`. Digital links remain at `GET /digital-links/:resourceId` and `GET /digital-links/itsa/:resourceId`.

Fraud-prevention headers are attached on every live HMRC call. Production access still requires HMRC’s own approval process.

## Tests

```bash
npm test
npm run test:e2e
```

## API surface

Auth, firms, users, clients, HMRC connections, VAT, ITSA, bookkeeping, audit, tasks, notifications, webhooks, documents, ledger, and client-portal routes. See `/docs` or [PLAYBOOK.md](./PLAYBOOK.md) for the accountant journey.
