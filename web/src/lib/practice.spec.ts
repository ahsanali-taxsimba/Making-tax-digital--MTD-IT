import { clientHmrcStatus, matchesQuery, pageTitle, practiceHomeTiles, roleLabel, taskColumn, taskTypeLabel } from "./practice";
import type { FirmDashboard } from "./types";

describe("practice helpers", () => {
  it("maps board columns", () => {
    expect(taskColumn("OPEN")).toBe("OPEN");
    expect(taskColumn("WAITING_ON_CLIENT")).toBe("WAITING_ON_CLIENT");
    expect(taskColumn("CANCELLED")).toBe("HIDDEN");
  });

  it("labels VAT and ITSA aliases together", () => {
    expect(taskTypeLabel("VAT_RETURN")).toBe("VAT return");
    expect(taskTypeLabel("MTD_VAT_RETURN")).toBe("VAT return");
    expect(taskTypeLabel("EOPS")).toBe("EOPS");
  });

  it("derives HMRC status from connections", () => {
    expect(clientHmrcStatus({ mtdConnections: [] })).toBe("not_connected");
    expect(clientHmrcStatus({ mtdConnections: [{ disconnectedAt: "2026-01-01" }] })).toBe("disconnected");
    expect(clientHmrcStatus({ mtdConnections: [{ disconnectedAt: null, scopes: ["read:vat"] }] })).toBe("connected");
  });

  it("filters search terms", () => {
    expect(matchesQuery(["Amelia Hartley", "AA123456A"], "hart")).toBe(true);
    expect(matchesQuery(["James Cole"], "noah")).toBe(false);
  });

  it("titles the three role workspaces", () => {
    expect(pageTitle("/admin/overview")).toBe("Platform dashboard");
    expect(pageTitle("/practice/dashboard")).toBe("Dashboard");
    expect(pageTitle("/practice/hmrc")).toBe("HMRC connections");
    expect(pageTitle("/practice/billing")).toBe("Billing");
    expect(pageTitle("/practice/agent")).toBe("Bookkeeping agent");
    expect(pageTitle("/invoices/extraction")).toBe("Invoice extraction");
    expect(pageTitle("/practice/invoices")).toBe("Invoice history");
    expect(pageTitle("/admin/billing/plans")).toBe("Billing");
    expect(pageTitle("/practice/audit")).toBe("Audit");
    expect(pageTitle("/practice/digital-links/doc-1")).toBe("Digital links");
    expect(pageTitle("/practice/digital-links/itsa/q1")).toBe("Digital links");
    expect(pageTitle("/client/home")).toBe("Home");
    expect(roleLabel("admin_owner")).toBe("Platform owner");
    expect(roleLabel("firm_accountant")).toBe("Accountant");
    expect(roleLabel("CLIENT")).toBe("Client");
  });

  it("puts every practice workspace on the home hub and hides audit tiles from staff", () => {
    const dashboard = {
      firm: { id: "f1", name: "Northbridge", contactEmail: "p", billingStatus: "TRIAL" },
      staffCount: 3,
      clientCount: 4,
      openVatObligations: 2,
      openItsaObligations: 3,
      openObligations: 5,
      unmatchedBank: 7,
      overdueInvoices: 1,
      openTasks: 6,
      documents: 12,
      receipts: 5,
      unattachedReceipts: 2,
      suggestedCategories: 4,
      suggestedMatches: 2,
      extractionReview: 1,
      hmrcConnected: 1,
      taskWorkload: [],
    } satisfies FirmDashboard;
    const accountant = practiceHomeTiles(dashboard, "firm_accountant");
    expect(accountant.map((tile) => tile.href)).toEqual([
      "/practice/vat",
      "/practice/itsa",
      "/practice/hmrc",
      "/practice/digital-links",
      "/practice/agent",
      "/practice/bank-feeds",
      "/practice/reconciliation",
      "/categorisation",
      "/matching",
      "/practice/documents",
      "/receipts",
      "/invoices/extraction",
      "/practice/clients",
      "/practice/staff",
      "/practice/tasks",
      "/practice/audit",
      "/practice/billing",
    ]);
    const staff = practiceHomeTiles(dashboard, "firm_staff");
    expect(staff.some((tile) => tile.href === "/practice/agent")).toBe(true);
    expect(staff.some((tile) => tile.href === "/practice/audit")).toBe(false);
    expect(staff.some((tile) => tile.href === "/practice/digital-links")).toBe(false);
  });
});
