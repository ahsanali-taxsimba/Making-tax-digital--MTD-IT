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
