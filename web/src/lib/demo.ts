import type { AuthUser } from "./types";

export const DEMO_FIRM_ID = "11111111-1111-4111-8111-111111111111";
export const DEMO_AMELIA_ID = "22222222-2222-4222-8222-222222222222";
export const DEMO_COMPANY_ID = "33333333-3333-4333-8333-333333333333";
export const DEMO_LANDLORD_ID = "66666666-6666-4666-8666-666666666666";
export const DEMO_BUSINESS_ID = "44444444-4444-4444-8444-444444444444";

export type DemoWorkspace = "practice" | "client" | "admin";

const firm = {
  id: DEMO_FIRM_ID,
  name: "Northbridge Accountants LLP",
  address: "14 King Street, Manchester, M2 6AW",
  contactEmail: "carol.w@example.org",
  planType: "PRACTICE",
  billingStatus: "ACTIVE",
};

export const DEMO_USERS: Record<DemoWorkspace, AuthUser> = {
  practice: {
    id: "demo-priya",
    email: "marco.r@example.org",
    role: "ADMIN",
    firmId: DEMO_FIRM_ID,
    clientId: null,
    name: "Priya Shah",
    principal: "firm",
    firmRole: "firm_admin",
  },
  client: {
    id: "demo-amelia",
    email: "tom.h@example.org",
    role: "CLIENT",
    firmId: DEMO_FIRM_ID,
    clientId: DEMO_AMELIA_ID,
    name: "Amelia Hartley",
    principal: "firm",
    firmRole: "firm_client",
  },
  admin: {
    id: "demo-owen",
    email: "grace.l@example.com",
    role: "ADMIN",
    firmId: DEMO_FIRM_ID,
    clientId: null,
    name: "Owen Blake",
    principal: "platform",
    platformRole: "admin_owner",
  },
};

const clients = [
  {
    id: DEMO_AMELIA_ID,
    name: "Amelia Hartley",
    type: "INDIVIDUAL",
    utr: "1234567890",
    vatRegistrationNumber: "888888888",
    nino: "AA123456A",
    riskLevel: "MEDIUM",
    assignedUserId: "demo-james",
    assignedUser: { id: "demo-james", name: "James Cole", role: "ACCOUNTANT" as const },
    mtdConnections: [{ id: "mtd-1", environment: "SANDBOX", scopes: ["read:vat", "write:vat"], tokenExpiresAt: "2026-12-01T12:00:00.000Z", disconnectedAt: null }],
  },
  {
    id: DEMO_COMPANY_ID,
    name: "Hartley Design Ltd",
    type: "COMPANY",
    utr: "1098765432",
    vatRegistrationNumber: "999999999",
    nino: null,
    riskLevel: "LOW",
    assignedUserId: "demo-james",
    assignedUser: { id: "demo-james", name: "James Cole", role: "ACCOUNTANT" as const },
    mtdConnections: [],
  },
  {
    id: DEMO_LANDLORD_ID,
    name: "Hartley Lets Portfolio",
    type: "LANDLORD",
    utr: "5566778899",
    nino: "CC123456C",
    riskLevel: "HIGH",
    assignedUserId: null,
    assignedUser: null,
    mtdConnections: [],
  },
];

const staff = [
  { id: "demo-priya", name: "Priya Shah", email: "marco.r@example.org", role: "ADMIN" as const, status: "ACTIVE" as const },
  { id: "demo-james", name: "James Cole", email: "carol.w@example.org", role: "ACCOUNTANT" as const, status: "ACTIVE" as const },
  { id: "demo-amelia", name: "Amelia Hartley", email: "tom.h@example.org", role: "CLIENT" as const, status: "ACTIVE" as const, clientId: DEMO_AMELIA_ID },
];

const vatObligations = [
  {
    id: "vat-26a1",
    clientId: DEMO_AMELIA_ID,
    periodKey: "26A1",
    start: "2026-01-01T00:00:00.000Z",
    end: "2026-03-31T00:00:00.000Z",
    due: "2026-05-07T00:00:00.000Z",
    status: "OPEN" as const,
  },
];

const itsaObligations = [
  {
    id: "itsa-q1",
    clientId: DEMO_AMELIA_ID,
    businessId: DEMO_BUSINESS_ID,
    business: { id: DEMO_BUSINESS_ID, type: "self-employment", tradingName: "Hartley Studio" },
    type: "QUARTERLY_UPDATE",
    taxYear: "2025-26",
    periodId: "2026-04-06_2026-07-05",
    start: "2026-04-06T00:00:00.000Z",
    end: "2026-07-05T00:00:00.000Z",
    due: "2026-08-07T00:00:00.000Z",
    status: "OPEN" as const,
  },
];

const vatReturns = [
  {
    id: "vr-1",
    clientId: DEMO_AMELIA_ID,
    periodKey: "25A4",
    status: "ACCEPTED",
    createdAt: "2026-02-04T10:00:00.000Z",
    box1: 4200,
    box4: 860,
    box5: 3340,
    box6: 21000,
    box7: 4300,
  },
];

const documents = [
  { id: "doc-1", clientId: DEMO_AMELIA_ID, fileName: "studio-q4-invoice.pdf", mimeType: "application/pdf", sizeBytes: 184320, category: "sales", status: "USED" as const, createdAt: "2026-03-12T09:00:00.000Z", type: "application/pdf", uploadedAt: "2026-03-12T09:00:00.000Z" },
  { id: "doc-2", clientId: DEMO_AMELIA_ID, fileName: "bank-feb-2026.csv", mimeType: "text/csv", sizeBytes: 8192, category: "bank", status: "PENDING" as const, createdAt: "2026-03-01T09:00:00.000Z", type: "text/csv", uploadedAt: "2026-03-01T09:00:00.000Z" },
];

const tasks = [
  { id: "task-1", firmId: DEMO_FIRM_ID, clientId: DEMO_AMELIA_ID, type: "VAT_RETURN", status: "OPEN", title: "Prepare 26A1 VAT return", dueDate: "2026-05-07T00:00:00.000Z", client: { id: DEMO_AMELIA_ID, name: "Amelia Hartley", type: "INDIVIDUAL" } },
  { id: "task-2", firmId: DEMO_FIRM_ID, clientId: DEMO_AMELIA_ID, type: "ITSA_UPDATE", status: "IN_PROGRESS", title: "Q1 2025-26 quarterly update", dueDate: "2026-08-07T00:00:00.000Z", client: { id: DEMO_AMELIA_ID, name: "Amelia Hartley", type: "INDIVIDUAL" } },
];

const dashboard = {
  firm,
  staffCount: 2,
  clientCount: 3,
  openVatObligations: 1,
  openItsaObligations: 1,
  openObligations: 2,
  unmatchedBank: 4,
  overdueInvoices: 1,
  openTasks: 2,
  documents: 2,
  receipts: 5,
  unattachedReceipts: 2,
  suggestedCategories: 3,
  suggestedMatches: 2,
  extractionReview: 1,
  hmrcConnected: 1,
  nextVatDue: { due: "2026-05-07T00:00:00.000Z", label: "26A1", clientName: "Amelia Hartley" },
  nextItsaDue: { due: "2026-08-07T00:00:00.000Z", label: "2025-26 Q1", clientName: "Amelia Hartley" },
  taskWorkload: [
    { userId: "demo-james", name: "James Cole", role: "ACCOUNTANT" as const, status: "ACTIVE" as const, open: 1, inProgress: 1, waitingOnClient: 0, completed: 4 },
    { userId: "demo-priya", name: "Priya Shah", role: "ADMIN" as const, status: "ACTIVE" as const, open: 1, inProgress: 0, waitingOnClient: 0, completed: 2 },
  ],
};

const hmrcConnections = [
  {
    clientId: DEMO_AMELIA_ID,
    clientName: "Amelia Hartley",
    environment: "sandbox",
    vatStatus: "connected",
    itsaStatus: "not_connected",
    connected: true,
    tokenExpiresAt: "2026-12-01T12:00:00.000Z",
  },
  {
    clientId: DEMO_COMPANY_ID,
    clientName: "Hartley Design Ltd",
    environment: "sandbox",
    vatStatus: "not_connected",
    itsaStatus: "not_connected",
    connected: false,
    tokenExpiresAt: null,
  },
];

const bankAccount = {
  id: "bank-1",
  clientId: DEMO_AMELIA_ID,
  name: "Hartley Studio current",
  sortCode: "09-01-01",
  accountNumber: "12345678",
  provider: "Yapily",
  currency: "GBP",
  balance: 18420.5,
  ledgerId: null,
  transactionCount: 3,
  unmatchedCount: 2,
  matchedCount: 1,
  ignoredCount: 0,
  reconciledCount: 0,
};

const bankTransactions = [
  { id: "txn-1", bankAccountId: "bank-1", date: "2026-03-02", amount: 2400, type: "CREDIT", description: "INV-1041 Hartley Studio", status: "UNMATCHED" },
  { id: "txn-2", bankAccountId: "bank-1", date: "2026-03-04", amount: -86.4, type: "DEBIT", description: "ADOBE SYSTEMS", status: "UNMATCHED" },
  { id: "txn-3", bankAccountId: "bank-1", date: "2026-03-06", amount: -420, type: "DEBIT", description: "HMRC VAT", status: "MATCHED" },
];

function parseBody(init?: RequestInit): Record<string, unknown> {
  if (!init?.body || typeof init.body !== "string") {
    return {};
  }
  try {
    return JSON.parse(init.body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function handleDemoRequest<T>(path: string, init: RequestInit = {}): T {
  const method = (init.method ?? "GET").toUpperCase();
  const url = new URL(path, "https://demo.mtd.local");
  const pathname = url.pathname.replace(/\/$/, "") || "/";
  const clientId = url.searchParams.get("clientId") ?? DEMO_AMELIA_ID;
  const body = parseBody(init);

  if (pathname === "/firms/me" || pathname === "/firm/me") return firm as T;
  if (pathname === "/firms/me/dashboard") return dashboard as T;
  if (pathname === "/firms/me/hmrc") return hmrcConnections as T;
  if (pathname === "/clients" || pathname === "/firm/clients") return clients as T;
  if (pathname === "/clients/me" || pathname === "/client/me" || pathname === "/portal/me") {
    return clients.find((row) => row.id === DEMO_AMELIA_ID) as T;
  }
  if (pathname.startsWith("/clients/") || pathname.startsWith("/firm/clients/")) {
    const id = pathname.split("/").pop();
    return (clients.find((row) => row.id === id) ?? clients[0]) as T;
  }
  if (pathname === "/users") return staff as T;
  if (pathname === "/vat/obligations") return vatObligations.filter((row) => row.clientId === clientId) as T;
  if (pathname === "/vat/returns" || pathname === "/firm/vat/returns") return vatReturns as T;
  if (pathname === "/itsa/obligations") return itsaObligations.filter((row) => row.clientId === clientId) as T;
  if (pathname === "/itsa/businesses") {
    return [{ id: DEMO_BUSINESS_ID, type: "self-employment", tradingName: "Hartley Studio" }] as T;
  }
  if (pathname === "/itsa/updates" || pathname === "/itsa/eops" || pathname === "/itsa/final-declaration") return [] as T;
  if (pathname === "/firm/itsa/submissions") return [] as T;
  if (pathname === "/tasks") return tasks as T;
  if (pathname === "/portal/documents" || pathname === "/client/documents" || pathname === "/firm/documents") {
    return (pathname === "/firm/documents" ? documents : documents.map(({ type: _t, uploadedAt: _u, ...row }) => row)) as T;
  }
  if (pathname === "/client/obligations" || pathname === "/portal/obligations") {
    return { vat: vatObligations, itsa: itsaObligations } as T;
  }
  if (pathname === "/hmrc/oauth/status") {
    return {
      connected: true,
      expiresAt: "2026-12-01T12:00:00.000Z",
      environment: "sandbox",
      connections: clients[0].mtdConnections,
    } as T;
  }
  if (pathname === "/bookkeeping/bank/accounts") return [bankAccount] as T;
  if (pathname.includes("/transactions")) {
    return { account: bankAccount, transactions: bankTransactions, suggestions: [] } as T;
  }
  if (pathname === "/admin/firms") {
    return [
      {
        id: DEMO_FIRM_ID,
        name: firm.name,
        slug: "northbridge",
        subscriptionPlan: "PRACTICE",
        createdAt: "2026-01-12T00:00:00.000Z",
        totalClients: 3,
        totalFirmUsers: 3,
        totalVatReturns: 1,
        totalItsaSubmissions: 0,
      },
    ] as T;
  }
  if (pathname === "/admin/system/health") return { status: "ok", service: "mtd-it-api", scope: "demo" } as T;
  if (pathname === "/admin/logs") return [{ id: "log-1", actionType: "auth.login", createdAt: "2026-03-17T09:00:00.000Z" }] as T;
  if (pathname === "/admin/feature-flags") return [{ id: "flag-1", key: "bookkeeping_agent", enabled: true }] as T;
  if (pathname === "/billing/plans") {
    return [
      {
        id: "plan-practice",
        slug: "practice",
        name: "Practice",
        audience: "PRACTICE",
        billingModel: "PER_UNIT",
        currency: "GBP",
        unitAmountPence: 1900,
        interval: "month",
        vatPercent: 20,
        vatInclusive: false,
        minQuantity: 1,
        maxQuantity: null,
        features: ["mtd_it", "vat_returns", "bank_feeds"],
        highlight: true,
        enabled: true,
        sortOrder: 1,
        priceLabel: "£19 / client",
        exampleMonthlyTotalPence: 5700,
      },
    ] as T;
  }
  if (pathname === "/billing/subscription") {
    return {
      firmId: DEMO_FIRM_ID,
      firmName: firm.name,
      billingStatus: "ACTIVE",
      activeClients: 3,
      features: ["mtd_it", "vat_returns"],
      subscription: {
        id: "sub-1",
        status: "active",
        quantity: 3,
        cancelAtPeriodEnd: false,
        monthlyNetPence: 5700,
        monthlyVatPence: 1140,
      },
    } as T;
  }
  if (pathname === "/agent/conversations") return [] as T;
  if (pathname.startsWith("/agent/")) {
    return {
      id: "agent-1",
      title: "Practice briefing",
      updatedAt: new Date().toISOString(),
      llm: "demo",
      messages: [
        { id: "m1", role: "assistant", content: "Amelia Hartley has an open VAT period 26A1 due 7 May 2026.", createdAt: new Date().toISOString() },
      ],
      actions: [],
      prompts: ["What needs my attention?"],
    } as T;
  }
  if (pathname === "/messages") return [] as T;
  if (pathname === "/receipts") return { receipts: [], count: 0 } as T;
  if (pathname.includes("/categorisation") || pathname.includes("/matching") || pathname.includes("/reconciliation")) {
    return { suggestions: [], count: 0, accounts: [bankAccount], transactions: bankTransactions } as T;
  }

  if (method === "POST" || method === "PATCH") {
    return { id: "demo-write", ...body, status: body.status ?? "OPEN" } as T;
  }
  if (pathname.endsWith("s") || pathname.includes("list")) {
    return [] as T;
  }
  return {} as T;
}
