# Security architecture

Making Tax Digital IT is a multi-tenant UK MTD VAT + ITSA + bookkeeping platform. Every request from a user to a practice module must pass the same defence-in-depth stack: edge controls, identity, tenant isolation, then the service, then data, audit, monitoring, and backup.

Three principals share one login. Platform staff never receive client records. Firms cannot see other firms. Clients cannot see other clients.

| Principal | Workspace | Tenant key |
| --- | --- | --- |
| Platform staff | `/admin/*` | none (counts only) |
| Accountancy firm | `/practice/*` | `firmId` |
| Firm client | `/client/*` | `clientId` (+ parent `firmId`) |

---

## 1. Defence-in-depth

```
┌──────────────────────────────────────────────┐
│                 USERS                        │
│  - Platform staff                            │
│  - Accountancy firms                         │
│  - Clients                                   │
└───────────────────────────┬──────────────────┘
                            ▼
┌──────────────────────────────────────────────┐
│        EDGE SECURITY & ACCESS CONTROL        │
│  - HTTPS (TLS 1.3)                           │
│  - WAF / rate limiting                       │
│  - IP restrictions (optional)                │
└───────────────────────────┬──────────────────┘
                            ▼
┌──────────────────────────────────────────────┐
│              AUTH & IDENTITY LAYER           │
│  - Login + MFA (TOTP / email / SMS)          │
│  - Session management                        │
│  - Password policies                         │
│  - Device / browser checks                   │
└───────────────────────────┬──────────────────┘
                            ▼
┌──────────────────────────────────────────────┐
│        AUTHZ & TENANT ISOLATION LAYER        │
│  - RBAC (platform / firm / client)           │
│  - ABAC (firmId, clientId)                   │
│  - Per-tenant data scoping                   │
│  - No cross-firm access                      │
└───────────────────────────┬──────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                 APPLICATION SERVICES (MICROSERVICES)          │
│  - MTD VAT service                                            │
│  - MTD ITSA service                                           │
│  - Bookkeeping service                                        │
│  - Bank feeds, OCR, AI, documents                             │
│  (All calls pass through authz + tenant isolation)            │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────┐
│           DATA SECURITY LAYER                │
│  - PostgreSQL (AES-256 at rest)              │
│  - Spaces (S3, encrypted)                    │
│  - Secrets manager (API keys, DB creds)      │
│  - Key rotation                              │
└───────────────────────────┬──────────────────┘
                            ▼
┌──────────────────────────────────────────────┐
│           AUDIT & COMPLIANCE LAYER           │
│  - Immutable audit logs                      │
│  - Digital links (VAT + ITSA)                │
│  - Hash-chained audit entries                │
│  - HMRC audit export                         │
└───────────────────────────┬──────────────────┘
                            ▼
┌──────────────────────────────────────────────┐
│        MONITORING & DETECTION LAYER          │
│  - Metrics (Prometheus/Grafana)              │
│  - Logs (Loki/ELK)                           │
│  - Security alerts (failed logins, MFA,      │
│    unusual access, API abuse)                │
│  - AI anomaly detection (optional)           │
└───────────────────────────┬──────────────────┘
                            ▼
┌──────────────────────────────────────────────┐
│        BACKUP & RESILIENCE LAYER             │
│  - Daily encrypted backups                   │
│  - Geo-redundant storage                     │
│  - Regular restore tests                     │
│  - Disaster recovery runbooks                │
└──────────────────────────────────────────────┘
```

A request never jumps a layer. Application services do not talk to Postgres, Spaces, or HMRC until JWT, role, and tenant checks have passed.

```
User
  -> Edge (TLS, WAF, rate limit)
    -> Auth (JWT / session)
      -> Authz (RBAC + firmId/clientId)
        -> Service (VAT / ITSA / bookkeeping / bank / OCR / AI / documents)
          -> Data (encrypted Postgres + Spaces)
            -> Audit (hash chain + digital links)
              -> Monitoring
                -> Backup
```

---

## 2. Layer map

### Users

| Who | Code | Rule |
| --- | --- | --- |
| Platform staff | `admin_*` roles, `/admin/*` | Aggregated firm counts only. No client rows. |
| Accountancy firms | `firm_admin`, `firm_accountant`, `firm_staff` | Scoped to `user.firmId`. |
| Clients | `firm_client` | Scoped to `user.clientId`. |

`RoleRouter` / `homePath(user)` opens exactly one workspace. Wrong tree or a tenant mismatch goes to `/access-denied`.

### Edge security & access control

| Control | Where it lives |
| --- | --- |
| HTTPS / TLS 1.3 | DigitalOcean load balancer (see `docs/ARCHITECTURE.md` §5) |
| Helmet headers | `src/main.ts` `app.use(helmet())` |
| CORS allow-list | `frontendOrigin` in `src/main.ts` |
| Rate limiting | global `ThrottlerGuard` in `src/app.module.ts` |
| Optional IP allow-list | Ingress / WAF annotation (cluster) |

`GET /health/live` and `GET /health/ready` skip auth and throttling so Kubernetes probes stay independent of user traffic.

### Auth & identity

| Control | Where it lives | Status |
| --- | --- | --- |
| Email + password login | `POST /auth/login` | Live |
| JWT access token | `AuthService` | Live |
| Refresh token rotation | hashed `RefreshToken` rows | Live |
| Password hashing | Argon2id (`PasswordHasher`) | Live (bcrypt hashes rehash on login) |
| MFA (TOTP) | `MfaService` + `JWT_MFA_SECRET` | Live for privileged roles |
| Device / browser checks | session + UA logging | Target |

Privileged roles that must take MFA: `admin_super`, `admin_owner`, `admin_developer`, `firm_admin`, `firm_accountant`.

Expired, tampered, or **MFA-purpose** JWTs are rejected by `JwtStrategy` before any controller runs. MFA challenge tokens are signed with `JWT_MFA_SECRET`, never `JWT_ACCESS_SECRET`. Five failed TOTP attempts lock MFA until an admin resets `mfaFailedCount`. Suspended firm users cannot refresh.

Privileged logins (`admin_super` / `admin_owner` / `firm_admin` / `firm_accountant`) take TOTP when `MFA_ENFORCE=true` (always on in production):

1. `POST /auth/login` returns `{ mfaRequired, mfaEnrollmentRequired, mfaChallengeToken }` instead of tokens.
2. First-time setup: `POST /auth/mfa/setup` then `POST /auth/mfa/confirm`.
3. Later logins: `POST /auth/mfa/verify`.

Passwords are hashed with Argon2id. Legacy bcrypt hashes still verify and are rehashed on the next successful login. Refresh tokens rotate: the previous row is revoked before a new one is issued. `/metrics` requires `METRICS_TOKEN` in production and is not on the public Ingress. OpenAPI `/docs` is off unless `SWAGGER_ENABLED=true`.

### Authz & tenant isolation

Every practice and portal route is behind JWT + a principal guard + `AuthorizationService` + `TenantIsolationInterceptor`.

```
JWT  principal + firmId + clientId
  -> JwtAuthGuard
  -> PlatformAuthGuard | FirmAuthGuard | ClientAuthGuard
  -> RolesGuard
  -> AuthorizationService.canPlatform / canFirm
  -> TenantIsolationInterceptor
       resource.firmId    must equal user.firmId
       resource.clientId  must equal user.clientId (firm_client)
  -> Controller
```

Cross-firm and cross-client reads are denied in the API and dropped in the UI (`withTenantQuery` never attaches another tenant id). Platform staff cannot call `/clients`, `/documents`, bank, or financial routes.

### Application services

These are logical services. Today they ship as NestJS modules in one API process, with the same authz stack on every route.

| Service | Module | Notes |
| --- | --- | --- |
| API Gateway | `AppModule` + Ingress | Auth routing, throttling, envelope |
| Auth | `src/auth` | Login, refresh, logout |
| Tenant management | `src/firms`, `src/users`, `src/clients`, `src/tenant` | Firms, staff, clients |
| MTD VAT | `src/vat` | Obligations, boxes 1–9, submit |
| MTD ITSA | `src/itsa` | Quarterly, EOPS, Final Declaration |
| Bookkeeping | `src/bookkeeping`, `src/ledger` | Journals, invoices, bills |
| Bank feeds | `src/yapily`, `src/manual-statements` | Yapily + CSV |
| Documents | `src/documents`, `src/receipts` | Upload, attach, OCR text |
| OCR | `src/invoice-extraction` (OCR path) | Merchant / date / amount / VAT |
| AI extraction | `src/invoice-extraction` | Invoice/receipt draft |
| Client portal | `src/portal` | Client-scoped views |
| Practice dashboard | `src/tenant` + Next `/practice` | Firm workspace |
| Platform admin | `src/admin` | Counts, flags, health |

No service is allowed a back door around authz. VAT and ITSA still call HMRC only through `HmrcClientService`.

### Data security

| Store | Protection |
| --- | --- |
| PostgreSQL | DigitalOcean managed encryption at rest (AES-256). Tenant columns `firmId` / `clientId` on every client-level table. |
| HMRC OAuth tokens | AES-256-GCM in `HmrcOAuthService` (never returned to the browser) |
| Yapily consent tokens | Encrypted at rest, never returned to the browser |
| Documents | DigitalOcean Spaces (S3), private objects |
| Secrets | Environment / secrets manager for DB, API keys, HMRC client secret |
| Key rotation | Replace `TOKEN_ENCRYPTION_KEY` and HMRC client secret without changing domain code |

### Audit & compliance

HMRC digital links require a reconstructable path from source document to filing.

| Control | Where it lives |
| --- | --- |
| Immutable `AuditLog` | `src/audit` + Postgres triggers |
| Hash chain | `prevHash` / `entryHash` via `hashAuditEntry` |
| VAT digital links | Document → Bank → Journal → VAT return |
| ITSA digital links | Document → Bank → Journal → Quarterly → EOPS → Final |
| Inspection export | `GET /audit/export` |
| Viewer | `/practice/audit` (firm admin / accountant) |
| Timelines | `/practice/digital-links/:id` and `/practice/digital-links/itsa/:id` |

`AuditInterceptor` records mutating practice actions with `beforeData` / `afterData`. `AuditService.log` is the single write path.

### Monitoring & detection

| Signal | Where it lives |
| --- | --- |
| Liveness | `GET /health/live` |
| Readiness (DB ping) | `GET /health/ready` |
| Structured API errors | `HttpExceptionFilter` envelope |
| Cluster metrics / logs | Prometheus, Grafana, Loki (DigitalOcean monitoring) |
| Alerts (target) | Failed logins, MFA failures, unusual accountant access, abnormal VAT/ITSA values, recon anomalies, API abuse, document-deletion spikes |

### Backup & resilience

| Control | Where it lives |
| --- | --- |
| Daily encrypted Postgres backups + PITR | DigitalOcean managed database |
| Geo-redundant object storage | Spaces with versioning |
| Drain on deploy | `preStop` sleep + `terminationGracePeriodSeconds` |
| Rollback | `kubectl rollout undo deployment <service>` |
| Restore tests / DR runbooks | Operations, not request path |

---

## 3. Request path through the stack

```
Internet user
    |
    v
DigitalOcean LB  (TLS 1.3, optional WAF)
    |
    v
Ingress  /api  /admin  /practice  /client
    |
    v
API process
    helmet + CORS + ThrottlerGuard
    JwtAuthGuard
    Platform | Firm | Client guard + RolesGuard
    TenantIsolationInterceptor
    AuditInterceptor
    |
    +-- VAT / ITSA / Bookkeeping / Bank / Documents / OCR / AI
    |
    v
PostgreSQL (AES-256 at rest, firmId/clientId on every client row)
DigitalOcean Spaces (documents)
    |
    v
AuditLog hash chain  +  digital-link builder
    |
    v
Health / metrics / logs  +  backups
```

Platform Admin stops before client-level stores. Practice and portal services never run without `firmId` (and `clientId` for `firm_client`).

---

## 4. Live vs target

| Layer | Live now | Target |
| --- | --- | --- |
| Edge | Helmet, CORS, throttling, Ingress TLS 1.3 | Optional IP allow-list per firm |
| Auth | JWT + refresh rotation + Argon2id (+ bcrypt verify) + TOTP MFA | Device fingerprinting, SMS/email fallback |
| Authz | RBAC + ABAC + tenant interceptor + identity headers | Same rules if services split into separate pods |
| Services | NestJS modules, shared `SecurityModule` | One Deployment per logical service |
| Data | AES-256-GCM for HMRC/Yapily/MFA secrets, previous-key rotation | Managed secrets store in production |
| Audit | Hash-chained immutable logs + VAT/ITSA digital links | Unchanged |
| Monitoring | `/health/live`, `/health/ready`, `/metrics`, security alerts | Grafana dashboards on Prometheus scrape |
| Backup | Nightly dump CronJob + DO Postgres PITR | Quarterly restore test |

Related: role routing and tenant isolation in [ARCHITECTURE.md](./ARCHITECTURE.md).
