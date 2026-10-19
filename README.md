# Making Tax Digital IT

A multi-tenant SaaS backend for UK accountancy firms and their clients. It covers Making Tax Digital for VAT and Making Tax Digital for Income Tax (ITSA), with a clean extension point for Corporation Tax and third-party ledgers such as Xero or QuickBooks.

## Stack choice

NestJS is the application framework because it gives modular boundaries, first-class DI, guards, interceptors, and OpenAPI out of the box — the same shape as a production practice platform. PostgreSQL is the system of record for tenancy, obligations, submissions, and audit. Prisma keeps the schema, migrations, and TypeScript types in one place. JWT access/refresh tokens secure the practice API; HMRC user-restricted OAuth is isolated behind gateway interfaces so sandbox and live can be swapped without touching domain services. HMRC access and refresh tokens are encrypted at rest with AES-256-GCM.

## Architecture

```
controllers  →  application services  →  repositories / Prisma
                     ↓
              HMRC gateway (mock | live)
                     ↓
         tasks · notifications · webhooks · audit
```

- **Tenancy:** every user belongs to a firm. Accountants see firm clients; client-portal users only see their linked client.
- **RBAC:** `ADMIN`, `ACCOUNTANT`, `CLIENT`.
- **HMRC:** OAuth authorisation-code flow, automatic token refresh, fraud-prevention headers, correlation IDs stored on every interaction.
- **Envelope:** `{ data, error }` on every response.
- **Charts of accounts:** landlord, sole trader, and company templates are provisioned when a client is created. Extra profiles can be applied later (for example a sole trader who also lets property).

## Local development

### With Docker

```bash
cp .env.example .env
docker compose up --build
```

API: http://localhost:3000  
OpenAPI: http://localhost:3000/docs  
Health: http://localhost:3000/health

### Without Docker (API process only)

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

### Seed users

| Role | Email | Password |
| --- | --- | --- |
| Firm admin | marco.r@example.org | PracticeAdmin123! |
| Accountant | carol.w@example.org | PracticeAdmin123! |
| Client portal | tom.h@example.org | PracticeAdmin123! |

`HMRC_MODE=mock` is the default. The mock gateway returns canned VAT/ITSA obligations and accepts submissions so the full accountant workflow can be exercised without HMRC credentials.

## Connect to the HMRC sandbox

1. Create an application on the [HMRC Developer Hub](https://developer.service.hmrc.gov.uk/).
2. Subscribe to **VAT (MTD)**, **Obligations (MTD)**, **Self Employment Business**, **Property Business**, **Individuals Business End of Period Statement**, and **Individual Calculations**.
3. Add redirect URI `http://localhost:3000/mtd/callback` (or your staging URL).
4. Put the client id/secret in `.env` and set:

```env
HMRC_MODE=live
HMRC_ENVIRONMENT=sandbox
HMRC_CLIENT_ID=...
HMRC_CLIENT_SECRET=...
HMRC_REDIRECT_URI=http://localhost:3000/mtd/callback
```

5. Create a sandbox organisation (VAT) and individual (ITSA) test user.
6. `POST /clients/:id/mtd/start-auth` and complete the HMRC grant screen.
7. Fetch obligations, then submit a VAT return or quarterly update.

Fraud-prevention headers are attached on every live HMRC call. Production access still requires HMRC’s own approval process.

## Tests

```bash
npm test
npm run test:e2e
```

## API surface

Auth, firms, users, clients, HMRC connections, VAT, ITSA, audit, tasks, notifications, webhooks, documents, ledger, and client-portal routes. See `/docs` or [PLAYBOOK.md](./PLAYBOOK.md) for the accountant journey.
