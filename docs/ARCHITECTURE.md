# Architecture

Making Tax Digital IT is a multi-tenant UK bookkeeping and MTD platform. Three principals share one login. `RoleRouter` opens exactly one workspace.

| Principal | Roles | Workspace | Tenant key |
| --- | --- | --- | --- |
| Platform staff | `admin_super`, `admin_owner`, `admin_marketing`, `admin_developer`, `admin_support` | Platform Admin Console `/admin/*` | none (counts only) |
| Accountancy firm | `firm_admin`, `firm_accountant`, `firm_staff` | Practice Dashboard `/practice/*` | `firmId` |
| Firm client | `firm_client` | Client Portal `/client/*` | `clientId` (and parent `firmId`) |

---

## 1. Login flow

Email and password authenticate a single user. The JWT carries `principal`, `platformRole` or `firmRole`, `firmId`, and `clientId`. `RoleRouter` then opens one workspace.

```
                         +--------------------------+
                         |        LOGIN PAGE        |
                         |         /login           |
                         +-------------+------------+
                                       |
                                       v
                         +--------------------------+
                         |     AUTHENTICATION       |
                         |   POST /auth/login       |
                         |   email + password       |
                         +-------------+------------+
                                       |
                                       v
                         +--------------------------+
                         |       LOAD USER          |
                         |  principal               |
                         |  role / platformRole     |
                         |  firmRole                |
                         |  firmId, clientId        |
                         +-------------+------------+
                                       |
                                       v
                     +--------------------------------------+
                     |            ROLE ROUTER               |
                     |         homePath(user)               |
                     +------------------+-------------------+
                                        |
        +-------------------------------+-------------------------------+
        |                               |                               |
        v                               v                               v
+----------------+              +----------------+                +----------------+
| PLATFORM STAFF |              | ACCOUNTANCY    |                |  CLIENT USER   |
| admin_super    |              | FIRM USER      |                |  firm_client   |
| admin_owner    |              | firm_admin     |                +--------+-------+
| admin_marketing|              | firm_accountant|                         |
| admin_developer|              | firm_staff     |                         v
| admin_support  |              +--------+-------+                +--------------------+
+-------+--------+                       |                        |   CLIENT PORTAL    |
        |                                |                        |   /client/home     |
        v                                v                        |   documents, VAT,  |
+----------------------+        +----------------------+          |   ITSA, messages   |
| PLATFORM ADMIN       |        | PRACTICE DASHBOARD   |          +--------------------+
| CONSOLE              |        | /practice/dashboard  |
| /admin/overview      |        | firm clients, VAT,   |
| firms, stats,        |        | ITSA, bank feeds,    |
| feature flags, logs  |        | reconciliation       |
+----------------------+        +----------------------+
```

Wrong tree or a `firmId` / `clientId` mismatch sends the user to `/access-denied`.

---

## 2. Full software architecture

Platform owners sit above tenants and never enter a firm workspace. Each firm is a tenant. Each `firm_client` is a sub-tenant of that firm.

```
                    +------------------------------------------+
                    |              PLATFORM OWNER              |
                    | admin_super / admin_owner / marketing    |
                    | developer / support                      |
                    +--------------------+---------------------+
                                         |
                                         v
                    +------------------------------------------+
                    |         PLATFORM ADMIN CONSOLE           |
                    | - Firms list                             |
                    | - Firm stats (counts only)               |
                    | - Feature flags                          |
                    | - Logs and system health                 |
                    | - Integrations                           |
                    +--------------------+---------------------+
                                         |
                                         v
              +--------------------------------------------------------+
              |                ACCOUNTANCY FIRMS (TENANTS)             |
              | firm_admin / firm_accountant / firm_staff              |
              +--------------------------+-----------------------------+
                                         |
                                         v
              +--------------------------------------------------------+
              |                PRACTICE DASHBOARD                      |
              | - Clients                                              |
              | - VAT returns                                          |
              | - ITSA submissions                                     |
              | - Bank feeds (Yapily + CSV)                            |
              | - Reconciliation                                       |
              | - Documents and receipts                               |
              | - Invoice extraction (AI + OCR)                        |
              | - Tasks / workflows                                    |
              +--------------------------+-----------------------------+
                                         |
                                         v
              +--------------------------------------------------------+
              |                     CLIENTS                            |
              | (firm_client users)                                    |
              +--------------------------+-----------------------------+
                                         |
                                         v
              +--------------------------------------------------------+
              |                     CLIENT PORTAL                      |
              | - Upload receipts / documents                          |
              | - View VAT / ITSA obligations                          |
              | - View documents                                       |
              | - Messages with accountant                             |
              +--------------------------------------------------------+
```

### Role routing into modules

```
AUTH --> TENANT MANAGEMENT --> (Firm or Platform)
              |
              |-- If Platform Staff
              |       --> PLATFORM ADMIN MODULE
              |           (no client data, only aggregated stats)
              |
              |-- If Firm Admin / Accountant / Staff
              |       --> PRACTICE MODULES
              |             - HMRC
              |             - Bank Feeds
              |             - Reconciliation
              |             - Documents
              |             - AI Extraction
              |             - Bookkeeping
              |
              +-- If Firm Client
                      --> CLIENT PORTAL MODULE
                            - Upload receipts
                            - View VAT / ITSA
                            - View documents
                            - Approve returns
                            - Messages
```

### Module boundaries

```
+------------------------------------------------------------------+
|                     PLATFORM BACKEND                             |
|                  multi-tenant NestJS API                         |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
| AUTH                                                             |
|  Login / logout / sessions / JWT                                 |
|  Role Router (platform vs firm vs client)                        |
|  RBAC + ABAC / TenantIsolationInterceptor                        |
|  HMRC OAuth token store (AES-256-GCM)                            |
+-------------------------------+----------------------------------+
                                |
           +--------------------+--------------------+
           |                    |                    |
           v                    v                    v
+-------------------+  +-------------------+  +-------------------+
| PLATFORM ADMIN    |  | TENANT MANAGEMENT |  | PRACTICE / CLIENT |
| view firms        |  | Firms (tenants)   |  | scoped by JWT     |
| aggregated stats  |  | Firm users        |  | firmId / clientId |
| feature flags     |  | Firm clients      |  +---------+---------+
| logs / health     |  | Subscription plan |            |
+-------------------+  +-------------------+            |
                                                        v
                 +----------------------------------------------+
                 |              PRACTICE MODULES                |
                 +--------------+---------------+---------------+
                 | HMRC         | BANK FEEDS    | DOCUMENTS     |
                 | VAT / ITSA   | Yapily + CSV  | OCR text      |
                 | obligations  | enrich / recon| tags / attach |
                 +--------------+---------------+---------------+
                 | OCR          | AI EXTRACT    | BOOKKEEPING   |
                 | merchant     | invoices      | journals      |
                 | date/amount  | receipts      | VAT/ITSA maps |
                 | VAT lines    | confidence    | trial balance |
                 +--------------+---------------+---------------+
```

Practice services call HMRC, bank feeds, documents, extraction, and bookkeeping. Clients never call another client’s routes. Platform staff cannot call `/clients`, `/documents`, or bank and financial routes.

### Backend module stack

Every module below is tenant-scoped except Platform Admin, which sees aggregated counts only.

```
+------------------------------------------------------------------+
|                     PLATFORM BACKEND                             |
|                  (multi-tenant architecture)                     |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
| AUTH MODULE                                                      |
|  - Login / logout / sessions                                     |
|  - Role Router (platform vs firm vs client)                      |
|  - RBAC + ABAC enforcement                                       |
|  - Tenant isolation (firmId, clientId)                           |
|  - JWT / OAuth2 (HMRC)                                           |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
| HMRC MODULE                                                      |
|  - MTD VAT obligations                                           |
|  - VAT submissions                                               |
|  - ITSA quarterly updates                                        |
|  - EOPS + Final Declaration                                      |
|  - HMRC OAuth token store                                        |
|  - HMRC API health monitor                                       |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
| BANK FEEDS MODULE                                                |
|  - Yapily integration                                            |
|  - Manual CSV upload                                             |
|  - Transaction ingestion                                         |
|  - Enrichment pipeline                                           |
|  - Reconciliation engine                                         |
|  - Journal posting                                               |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
| OCR MODULE                                                       |
|  - OCR extraction (PDF / JPG / PNG)                              |
|  - Text cleaning                                                 |
|  - Merchant / date / amount detection                            |
|  - Invoice number detection                                      |
|  - VAT line detection                                            |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
| AI EXTRACTION MODULE                                             |
|  - Invoice extraction (supplier, totals, line items)             |
|  - Receipt extraction                                            |
|  - Confidence scoring                                            |
|  - Draft invoice / bill creation                                 |
|  - Auto-matching with bank transactions                          |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
| DOCUMENT MANAGEMENT MODULE                                       |
|  - Upload documents (PDF / JPG / PNG)                            |
|  - Tagging system                                                |
|  - OCR text storage                                              |
|  - Attach to bank transactions                                   |
|  - Attach to invoices / bills / journals                         |
|  - Search by OCR text                                            |
|  - Audit logs                                                    |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
| BOOKKEEPING MODULE                                               |
|  - Chart of accounts                                             |
|  - Journal entries                                               |
|  - Ledger posting                                                |
|  - Trial balance                                                 |
|  - VAT / ITSA mapping                                            |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
| TENANT MANAGEMENT MODULE                                         |
|  - Firms (tenants)                                               |
|  - Firm users (admins, accountants, staff)                       |
|  - Firm clients                                                  |
|  - Firm isolation enforcement                                    |
|  - Subscription plans                                            |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
| PLATFORM ADMIN MODULE                                            |
|  - View firms (no client data)                                   |
|  - Aggregated stats per firm                                     |
|  - Feature flags                                                 |
|  - System health                                                 |
|  - Logs                                                          |
|  - Marketing console                                             |
|  - Developer console                                             |
+------------------------------------------------------------------+
```

Auth and tenant management run on every request. HMRC, bank feeds, OCR, extraction, documents, and bookkeeping are practice modules and stay inside `firmId`. Platform Admin never loads those client-level stores.

### Service map

These are logical services. Today they ship as NestJS modules in one API process, with the same role and tenant guards on every route.

```
+----------------------------------------------------------------------+
| API GATEWAY / ROUTER                                                 |
|  - Auth routing                                                      |
|  - Role routing (platform vs firm vs client)                         |
|  - Tenant isolation (firmId, clientId)                               |
|  - Rate limiting                                                     |
+----------------------------------+-----------------------------------+
                                   |
                                   v
+----------------------------------------------------------------------+
| AUTH SERVICE                                                         |
|  - Login / logout / sessions                                         |
|  - JWT issuing                                                       |
|  - RBAC + ABAC enforcement                                           |
|  - Multi-tenant context injection                                    |
+----------------------------------+-----------------------------------+
                                   |
                                   v
+----------------------------------------------------------------------+
| TENANT MANAGEMENT SERVICE                                            |
|  - Firms (tenants)                                                   |
|  - Firm users (admins, accountants, staff)                           |
|  - Firm clients                                                      |
|  - Subscription plans                                                |
|  - Tenant isolation rules                                            |
+----------------------------------+-----------------------------------+
                                   |
              +--------------------+--------------------+
              |                                         |
              v                                         v
+--------------------------------+     +--------------------------------+
| PLATFORM ADMIN SERVICE         |     | PRACTICE / CLIENT SERVICES     |
|  - View firms (no client data) |     |  scoped by firmId / clientId   |
|  - Aggregated stats per firm   |     +----------------+---------------+
|  - Feature flags               |                      |
|  - Logs and system health      |                      |
|  - Marketing console           |                      |
|  - Developer console           |                      |
+--------------------------------+                      |
                                                        v
+----------------------------------------------------------------------+
| HMRC INTEGRATION SERVICE                                             |
|  VAT obligations / submissions · ITSA quarterly · EOPS · Final       |
|  Browser Gov-Client headers · obligation sync · digital-link submit  |
|  OAuth token store · API health                                      |
+----------------------------------+-----------------------------------+
                                   v
+----------------------------------------------------------------------+
| BANK FEEDS SERVICE                                                   |
|  Yapily · CSV · sync · enrich · reconciliation · journal posting     |
+----------------------------------+-----------------------------------+
                                   v
+----------------------------------------------------------------------+
| OCR SERVICE                                                          |
|  PDF/JPG/PNG · text cleaning · merchant/date/amount · VAT lines      |
+----------------------------------+-----------------------------------+
                                   v
+----------------------------------------------------------------------+
| AI EXTRACTION SERVICE                                                |
|  Invoices / receipts · confidence · draft bills · bank matching      |
+----------------------------------+-----------------------------------+
                                   v
+----------------------------------------------------------------------+
| DOCUMENT MANAGEMENT SERVICE                                          |
|  Upload · tags · OCR text · attach · search · audit                  |
+----------------------------------+-----------------------------------+
                                   v
+----------------------------------------------------------------------+
| BOOKKEEPING SERVICE                                                  |
|  Chart of accounts · journals · ledger · trial balance · VAT/ITSA    |
+----------------------------------+-----------------------------------+
                                   |
              +--------------------+--------------------+
              |                                         |
              v                                         v
+--------------------------------+     +--------------------------------+
| CLIENT PORTAL SERVICE          |     | ACCOUNTANT PRACTICE SERVICE    |
|  - Client dashboard            |     |  - Practice dashboard          |
|  - Upload receipts             |     |  - Client management           |
|  - View VAT / ITSA             |     |  - VAT / ITSA workflows        |
|  - Approve returns             |     |  - Bank feeds and recon        |
|  - View documents              |     |  - Document review             |
|  - Messages with accountant    |     |  - Invoice extraction review   |
|                                |     |  - Tasks / workflows           |
+--------------------------------+     +--------------------------------+
```

After tenant context is set, platform staff stop at Platform Admin Service. Firm staff enter Accountant Practice Service, which calls HMRC, bank feeds, OCR, extraction, documents, and bookkeeping. Firm clients enter Client Portal Service only.

### Service call graph

```
API Gateway
    |
    v
Auth Service
    |
    v
Tenant Management Service
    |
    +-- Depending on role:
    |       - Platform Admin Service
    |       - Accountant Practice Service
    |       - Client Portal Service
    |
    v
Practice Service --> HMRC Service (VAT / ITSA)
Practice Service --> Bank Feeds Service
Practice Service --> Document Service
Practice Service --> AI Extraction Service
Practice Service --> Bookkeeping Service

Document Service --> OCR Service --> AI Extraction Service
Bank Feeds Service --> Bookkeeping Service
AI Extraction Service --> Bookkeeping Service
```

Platform Admin Service does not call HMRC, bank feeds, documents, extraction, or bookkeeping. Those edges stay inside the firm tenant.

---

## 3. Tenant isolation

Each accountancy firm is a hard tenant. Client records, documents, and bank feeds carry `firmId` (and `clientId` for sub-tenant rows). Cross-tenant reads are denied in the UI and in the API.

```
+------------------------------+
|        PLATFORM STAFF        |
|  (NO ACCESS TO CLIENT DATA)  |
|  counts only:                |
|   totalClientsPerFirm        |
|   totalUsersPerFirm          |
|   totalVatReturnsPerFirm     |
+---------------+--------------+
                |
                | aggregated stats only
                v
+------------------------------+     +------------------------------+
|         FIRM A (tenant)      |     |         FIRM B (tenant)      |
| firmId = A                   |     | firmId = B                   |
| Users: firm_admin / staff    |     | Users: firm_admin / staff    |
| Clients: A1, A2, A3          |     | Clients: B1, B2              |
| Documents: A*                |     | Documents: B*                |
| Bank feeds: A*               |     | Bank feeds: B*               |
|         |                    |     |         |                    |
|         v                    |     |         v                    |
|  A1 portal != A2 portal      |     |  B1 portal != B2 portal      |
+------------------------------+     +------------------------------+

FIRM A cannot see FIRM B
FIRM B cannot see FIRM A
A1 cannot see A2
Platform staff cannot open A1, A2, B1, or B2
```

### Enforcement

```
Request
   |
   v
JWT  principal + firmId + clientId
   |
   v
Frontend
   RoleRouter        --> one layout
   useTenantGuard    --> /access-denied on mismatch
   withTenantQuery   --> attach own firmId / clientId
                     --> drop foreign tenant ids
                     --> platform calls send neither
   |
   v
Backend
   PlatformAuthGuard / FirmAuthGuard / ClientAuthGuard
   AuthorizationService.canPlatform / canFirm
   TenantIsolationInterceptor
   resource.firmId must equal user.firmId
   firm_client.resource.clientId must equal user.clientId
```

Seed check: Northbridge (`marco.r@example.org`) cannot read Westgate (`zoe.m@example.net`). Platform users (`grace.l@example.com` and the other `admin_*` accounts) receive firm counts only.

---

## 4. Data model

Platform users have no `firmId`. Every firm-scoped row carries `firmId`. Client-scoped rows also carry `clientId`. In the live schema, `FirmUser` is the `User` table.

```
+------------------------------+
| PLATFORM USERS               |
+------------------------------+
  PlatformUser
  +------------------------------------------+
  | id (PK)                                  |
  | role (admin_super, admin_owner,          |
  |       admin_marketing, admin_developer,  |
  |       admin_support)                     |
  | name                                     |
  | email                                    |
  | passwordHash                             |
  | createdAt                                |
  +------------------------------------------+

+------------------------------+
| ACCOUNTANCY FIRMS (TENANTS)  |
+------------------------------+
  Firm
  +------------------------------------------+
  | id (PK)                                  |
  | name                                     |
  | slug                                     |
  | subscriptionPlan                         |
  | createdAt                                |
  +------------------------------------------+

  FirmUser  (table: User)
  +------------------------------------------+
  | id (PK)                                  |
  | firmId (FK -> Firm.id)                   |
  | role (firm_admin, firm_accountant,       |
  |       firm_staff, firm_client)           |
  | name                                     |
  | email                                    |
  | passwordHash                             |
  | clientId (nullable, FK -> Client.id)     |
  | createdAt                                |
  +------------------------------------------+

+------------------------------+
| CLIENTS (SUB-TENANTS)        |
+------------------------------+
  Client
  +------------------------------------------+
  | id (PK)                                  |
  | firmId (FK -> Firm.id)                   |
  | name                                     |
  | type (sole_trader, landlord, company)    |
  | nino (nullable)                          |
  | vrn (nullable)                           |
  | createdAt                                |
  +------------------------------------------+

+------------------------------+
| BANK FEEDS                   |
+------------------------------+
  BankAccount
  +------------------------------------------+
  | id (PK)                                  |
  | firmId (FK)  clientId (FK)               |
  | provider (yapily, csv)                   |
  | externalAccountId  name  currency        |
  | createdAt                                |
  +------------------------------------------+

  BankTransaction
  +------------------------------------------+
  | id (PK)                                  |
  | bankAccountId (FK)                       |
  | firmId (FK)  clientId (FK)               |
  | date  amount  type (credit/debit)        |
  | description  status  createdAt           |
  +------------------------------------------+

+------------------------------+
| DOCUMENT MANAGEMENT          |
+------------------------------+
  DocumentFile
  +------------------------------------------+
  | id (PK)                                  |
  | firmId (FK)  clientId (FK)               |
  | type (receipt, invoice, bill, contract,  |
  |       statement, hmrc_letter)            |
  | fileName  fileType  fileSize             |
  | storageUrl  ocrText  tags (JSON)         |
  | createdAt                                |
  +------------------------------------------+

  DocumentAttachment
  +------------------------------------------+
  | id (PK)                                  |
  | documentId (FK -> DocumentFile.id)       |
  | firmId (FK)  clientId (FK)               |
  | targetType (bank_transaction, invoice,   |
  |             bill, journal_entry,         |
  |             vat_return, itsa_submission) |
  | targetId  attachedAt                     |
  +------------------------------------------+

+------------------------------+
| OCR + AI EXTRACTION          |
+------------------------------+
  InvoiceExtraction
  +------------------------------------------+
  | id (PK)                                  |
  | documentId (FK)                          |
  | firmId (FK)  clientId (FK)               |
  | extractedData (JSON)                     |
  | confidenceScore                          |
  | status (draft, approved, failed)         |
  | createdAt                                |
  +------------------------------------------+

+------------------------------+
| BOOKKEEPING                  |
+------------------------------+
  Invoice / Bill
  +------------------------------------------+
  | id (PK)                                  |
  | firmId (FK)  clientId (FK)               |
  | supplierId (nullable)                    |
  | invoiceNumber  invoiceDate  dueDate      |
  | totalNet  totalVat  totalGross  status   |
  | createdAt                                |
  +------------------------------------------+

  JournalEntry                         JournalLine
  +--------------------------------+   +--------------------------------+
  | id (PK)                        |   | id (PK)                        |
  | firmId (FK)  clientId (FK)     |   | journalEntryId (FK)            |
  | date  reference  createdAt     |   | accountCode  debit  credit     |
  +--------------------------------+   +--------------------------------+

+------------------------------+
| HMRC (VAT + ITSA)            |
+------------------------------+
  VATReturn
  +------------------------------------------+
  | id (PK)                                  |
  | firmId (FK)  clientId (FK)               |
  | periodStart  periodEnd                   |
  | box1..box9  status  hmrcSubmissionId     |
  | createdAt                                |
  +------------------------------------------+

  ITSASubmission
  +------------------------------------------+
  | id (PK)                                  |
  | firmId (FK)  clientId (FK)               |
  | taxYear                                  |
  | type (quarterly, eops, final)            |
  | status  hmrcSubmissionId                 |
  | createdAt                                |
  +------------------------------------------+

+------------------------------+
| AUDIT LOGS                   |
+------------------------------+
  AuditLog
  +------------------------------------------+
  | id (PK)                                  |
  | firmId (FK)                              |
  | clientId (nullable FK)                   |
  | userId (FK -> FirmUser or PlatformUser)  |
  | action  resourceType  resourceId         |
  | metadata (JSON)  createdAt               |
  +------------------------------------------+
```

Tenant rule: a query that returns `BankTransaction`, `DocumentFile`, `Invoice`, `VATReturn`, or `ITSASubmission` must include `WHERE firmId = user.firmId`. Client portal queries also require `clientId = user.clientId`. Platform Admin queries `Firm` counts only and never these client-level tables.

---

## 5. Deployment (DigitalOcean Kubernetes)

Today the API is a NestJS modular monolith (`mtd-api`, port 3000) and the UI is Next.js. Thirteen named modules share one process, one JWT, and one tenant interceptor. Manifests in `deploy/k8s/` ship that single Deployment; splitting into per-service pods is a later extract, not the current runtime. Ingress still splits the three workspaces: `/admin`, `/practice`, `/client`. `/metrics` is not on the public Ingress — scrape in-cluster with `METRICS_TOKEN`.

```
+------------------------------------------------------------------+
| INTERNET USERS                                                   |
|  Platform staff (admin_super, admin_owner, ...)                  |
|  Accountancy firms (firm_admin, accountants, staff)              |
|  Clients (firm_client)                                           |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
| DIGITALOCEAN LOAD BALANCER (HTTPS)                               |
|  TLS termination · optional WAF · route to K8s Ingress           |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
| DIGITALOCEAN KUBERNETES CLUSTER                                  |
|  3-5 nodes (autoscaling)                                         |
|  Node pools: general · compute-heavy (AI/OCR) · workers          |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
| INGRESS CONTROLLER  (NGINX or Traefik)                           |
|  /api      -> API Gateway                                        |
|  /admin    -> Admin Console                                      |
|  /practice -> Firm Dashboard                                     |
|  /client   -> Client Portal                                      |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
| API GATEWAY POD                                                  |
|  Auth routing · role routing · tenant isolation                  |
|  Rate limiting · JWT validation                                  |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
| MICROSERVICES (PODS)                                             |
|  Each service: Deployment · ClusterIP · HTTP/gRPC                |
|  Optional service mesh (Istio / Linkerd)                         |
|                                                                  |
|  Auth · Tenant Management · Platform Admin                       |
|  Accountant Practice · Client Portal                             |
|  HMRC Integration · Bank Feeds · OCR · AI Extraction             |
|  Document Management · Bookkeeping                               |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
| BACKGROUND WORKERS (JOBS)                                        |
|  Bank feed sync · OCR · AI extraction                            |
|  HMRC submission · document indexing                             |
+-------------------------------+----------------------------------+
                                |
          +---------------------+---------------------+
          |                     |                     |
          v                     v                     v
+---------------------+ +-------------------+ +-------------------+
| DO MANAGED POSTGRES | | DO SPACES (S3)    | | DO REDIS          |
| Multi-tenant schema | | Documents         | | Cache / sessions  |
| Read replicas       | | Receipts/invoices | | Rate-limit tokens |
| Backups + PITR      | | Version + lifecycle| | Job queues       |
+---------------------+ +-------------------+ +-------------------+

+------------------------------------------------------------------+
| DIGITALOCEAN MONITORING                                          |
|  Prometheus · Grafana · Loki / DO Logs · Alertmanager            |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
| DIGITALOCEAN REGISTRY                                            |
|  CI/CD pushes images · cluster pulls images                      |
+------------------------------------------------------------------+
```

Ingress paths stay aligned with `RoleRouter`: platform staff hit `/admin`, firm users hit `/practice`, clients hit `/client`. OCR and AI extraction land on the compute-heavy node pool. Bank sync, OCR, extraction, HMRC submit, and document index jobs run as workers, not on the request path.

### Liveness and readiness probes

`GET /health/live` is unauthenticated, skips rate limiting, and does not touch the database. Kubernetes restarts the pod after 3 failures. A database blip must not fail liveness.

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 20
  failureThreshold: 3
```

`GET /health/ready` is unauthenticated and skips rate limiting. It pings PostgreSQL. Kubernetes removes the pod from Service endpoints after 3 failures.

```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3
```

The container listens on `PORT` (default 3000). A 200 means the process can take traffic. A 503 means the database is unreachable.

### Pre-stop grace

On SIGTERM, Kubernetes runs `preStop` before the container is killed. Sleep 5 seconds so the Service can drop the pod from endpoints and in-flight requests can finish.

```yaml
lifecycle:
  preStop:
    exec:
      command: ["/bin/sh", "-c", "sleep 5"]
```

Pair this with `terminationGracePeriodSeconds` of at least 15 so NestJS can drain after the sleep.

### Rollback

If a rollout is unhealthy (readiness failing, error rate up), revert the last Deployment revision. Kubernetes restores the previous ReplicaSet.

```bash
./deploy/k8s/rollback.sh mtd-api
```

There is one API Deployment (`mtd-api`). Logical service names in metrics and audit (`auth`, `mtd-vat`, `mtd-itsa`, …) are labels, not pods.

`preStop` still runs on the outgoing pods. Confirm `/health/ready` is 200 on the restored revision before sending traffic.

---

## 6. Security architecture

Defence-in-depth (edge → auth → authz → services → data → audit → monitoring → backup) is in [docs/SECURITY.md](./SECURITY.md). Every VAT, ITSA, bookkeeping, bank, OCR, AI, and document call passes JWT, RBAC, and `firmId` / `clientId` isolation before it touches Postgres or Spaces.
