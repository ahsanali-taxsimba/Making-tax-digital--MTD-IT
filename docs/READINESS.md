# Readiness report — Making Tax Digital IT

Audit date: 2026-10-20. Scope: entire repository (NestJS modular monolith + Next.js + Prisma + deploy). This report states whether the system is ready for HMRC sandbox testing, production, a security audit, and developer onboarding **after** the corrections in this branch.

Runtime remains **one API process** (`AppModule`) with thirteen **logical** services. It is not thirteen Kubernetes Deployments.

```
 Browser / Next.js
        |
        v
 TLS 1.3 + Helmet + CORS + Throttler
        |
        v
 JWT (purpose=access, secret != MFA secret)
        |
        v
 RBAC (platform | firm | client) + tenant interceptor
        |
        +-- Auth / Tenant / Practice / Portal / Admin
        +-- Bookkeeping / Bank / OCR / Extraction / Documents
        +-- HmrcClientService  -->  test-api or api.service.hmrc.gov.uk
        |
        v
 PostgreSQL (hash-chained AuditLog, AES-256-GCM secrets)
```

## Verdict

| Gate | Ready? | Why |
| --- | --- | --- |
| HMRC VAT sandbox testing | **Yes, with credentials** | VAT paths, OAuth, fraud-prevention headers, `Gov-Test-Scenario`, sandbox hosts, and test-user create/login are in place. Needs a Developer Hub app, `HMRC_MODE=sandbox`, and a created organisation test user. |
| HMRC ITSA sandbox testing | **Yes, with credentials** | Obligations expand to the three official feeds. Quarterly PUT, EOPS POST, and final declaration now use current HMRC path shapes (calculationId in the URL). Needs an individual test user, NINO, and `businessId`. |
| Production deployment | **No** | Sandbox-ready, not production-ready. Missing HMRC production approval, live fraud-header collection from the browser, SSO, managed secrets, WAF in front of a real cluster, restore tests, and a split of the monolith if independent scaling is required. |
| Security audit | **Almost** | Critical JWT/MFA, IDOR, RBAC default-deny, metrics, and secrets checks are fixed. Residual: MFA lockout is counter-based (no timed unlock), fraud headers still have sandbox placeholders, audit unique constraint can fail on historical duplicates. |
| Developer onboarding | **Yes** | README + PLAYBOOK + ARCHITECTURE + SECURITY + this report, `.env.example`, `HMRC_MODE=mock`, Prisma seed, CI workflow. |

## What this audit fixed

### Critical

- MFA challenge JWTs used the **access** secret and `JwtStrategy` ignored `purpose`, so a 5-minute MFA token was a valid API session. Challenges now sign with `JWT_MFA_SECRET`; access tokens carry `purpose: "access"`; strategy rejects anything else.
- `PATCH /notifications/:id/read` updated by id only (cross-tenant IDOR). Updates are now `firmId` + (`userId` null or self).
- HMRC EOPS used a literal `/nino/` path segment; final declaration omitted `calculationId` from the URL; self-employment PUT targeted the **list** period path. Paths now match current HMRC APIs.
- Refresh granted tokens to **suspended** firm users.
- `firmMayAccessPath` default-allowed `firm_client` onto `/vat`, `/itsa`, and other practice APIs. Clients are default-deny except `/client`, `/portal`, `/notifications`, `/auth`, `/health`, `/hmrc/oauth`.
- Production Docker entrypoint always ran `prisma db seed`. Seed now requires `ALLOW_DB_SEED=true` (or non-production).
- No CI workflow; Kubernetes was probe fragments on port 8080 while the app listens on 3000; `/metrics` was on the public Ingress; web image ran `npm run dev`.

### High / medium

- HMRC refresh required a new `refresh_token` on every grant; HMRC often omits it. Existing refresh token is reused.
- `SecretsService` only rejected the substring `change-me`. Production now rejects short/placeholder secrets and equal access/MFA secrets.
- Yapily callback `state` was the connection UUID. It is now a 48-hex nonce stored as `callbackState`.
- Sandbox test users had no `firmId`. Create/list/get are firm-scoped.
- Digital links attached the **latest** ITSA update for a client when the resource id was not an update. Lookup is by id only.
- Audit append is a serializable transaction with unique `(firmId, prevHash)` and retry on conflict.
- Fraud-prevention header set expanded to the WEB_APP_VIA_SERVER catalogue; `Gov-Test-Scenario` is forwarded from query/header/body on sandbox.
- Swagger is off in production unless `SWAGGER_ENABLED=true`. `/metrics` requires `METRICS_TOKEN` in production.
- `MerchantDetectionService` no longer default-constructs `OCRParserService` (Nest DI).
- Five failed TOTP attempts lock MFA.

## Remaining gaps (do not treat as done)

- Browser has not yet posted real `Gov-Client-*` values; server fills placeholders that HMRC will reject in live fraud checks.
- ITSA GET `/income-tax/{nino}/income-expenses` is a **facade**. Live HMRC has no nino-only income GET; period bounds come from income-and-expenditure obligations and figures from the ledger.
- No SSO / IdP (`ssoProviders()` is empty).
- Accountant assignment restriction is opt-in (`restrictAccountantsToAssigned`).
- Hash chain uniqueness may fail to apply on a database that already has duplicate `(firmId, prevHash)` from the old race.
- Background workers (OCR, bank sync, HMRC submit) still run in-process.
- DigitalOcean cluster, WAF, managed Postgres PITR restore drill, and HMRC production application are operator work, not code.

## How to run VAT / ITSA sandbox

1. Create a Developer Hub application. Redirect URI must match `HMRC_SANDBOX_REDIRECT_URI`.
2. Set `HMRC_MODE=sandbox`, `HMRC_SANDBOX=true`, sandbox client id/secret.
3. `POST /hmrc/sandbox/test-users` with `{ "type": "organisation" }` (VAT) or `"individual"` (ITSA).
4. `POST /hmrc/sandbox/test-users/:id/login` with a client id; sign in on the grant screen.
5. Optional: send `Gov-Test-Scenario` or `?govTestScenario=` on a call.
6. VAT: `GET /vat/obligations`, `POST /vat/returns`. ITSA: `GET /itsa/obligations`, `PUT` quarterly, `POST` EOPS, `POST` final declaration **with calculationId**.

## HMRC hosts (canonical)

| Use | Sandbox | Live |
| --- | --- | --- |
| REST + token | `https://test-api.service.hmrc.gov.uk` | `https://api.service.hmrc.gov.uk` |
| User grant screen | `https://test-www.tax.service.gov.uk` | `https://www.tax.service.gov.uk` |
| Authorize (Developer Hub) | `https://test-api.service.hmrc.gov.uk/oauth/authorize` | `https://www.tax.service.gov.uk/oauth/authorize` |

VAT: `/organisations/vat/{vrn}/obligations|returns|payments`.  
ITSA live expansion: obligations (3 feeds), UK property PUT, self-employment PUT `/{nino}/{businessId}/{taxYear}/{periodId}`, EOPS POST without `/nino/`, final declaration POST with `{calculationId}` in the path.
