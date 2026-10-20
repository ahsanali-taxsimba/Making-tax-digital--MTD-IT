import { canFirm, canPlatform, firmMayAccessPath, platformMayAccessPath } from "./policy";
import type { FirmUserView, PlatformUserView } from "./roles";

const superAdmin: PlatformUserView = { id: "p1", role: "admin_super", name: "Samira", email: "s", isActive: true };
const owner: PlatformUserView = { id: "p2", role: "admin_owner", name: "Owen", email: "o", isActive: true };
const marketing: PlatformUserView = { id: "p3", role: "admin_marketing", name: "Lila", email: "l", isActive: true };
const developer: PlatformUserView = { id: "p4", role: "admin_developer", name: "Theo", email: "t", isActive: true };
const support: PlatformUserView = { id: "p5", role: "admin_support", name: "Ruth", email: "r", isActive: true };

const adminA: FirmUserView = { id: "a1", firmId: "firm-a", role: "firm_admin", name: "Priya", email: "p", isActive: true, clientId: null };
const adminB: FirmUserView = { id: "b1", firmId: "firm-b", role: "firm_admin", name: "Helen", email: "h", isActive: true, clientId: null };
const accountant: FirmUserView = { id: "a2", firmId: "firm-a", role: "firm_accountant", name: "James", email: "j", isActive: true, clientId: null };
const staff: FirmUserView = { id: "a3", firmId: "firm-a", role: "firm_staff", name: "Noah", email: "n", isActive: true, clientId: null };
const client: FirmUserView = { id: "c1", firmId: "firm-a", role: "firm_client", name: "Amelia", email: "am", isActive: true, clientId: "client-1" };

describe("platform authorization", () => {
  it("lets owners see firm stats but never client records", () => {
    expect(canPlatform(superAdmin, "view_firm_stats")).toBe(true);
    expect(canPlatform(superAdmin, "manage_firm_subscription")).toBe(true);
    expect(canPlatform(owner, "view_firm_stats")).toBe(true);
    expect(canPlatform(owner, "manage_firm_subscription")).toBe(false);
    expect(canPlatform(superAdmin, "view_clients")).toBe(false);
    expect(canPlatform(superAdmin, "view_documents")).toBe(false);
    expect(canPlatform(superAdmin, "view_bank_transactions")).toBe(false);
    expect(canPlatform(owner, "view_financials")).toBe(false);
  });

  it("scopes marketing, developer and support correctly", () => {
    expect(canPlatform(marketing, "view_firm_counts_only")).toBe(true);
    expect(canPlatform(marketing, "view_firm_stats")).toBe(false);
    expect(canPlatform(developer, "view_system_health")).toBe(true);
    expect(canPlatform(developer, "view_firms")).toBe(false);
    expect(canPlatform(support, "view_firm_and_client_metadata")).toBe(true);
    expect(canPlatform(support, "view_documents")).toBe(false);
  });

  it("blocks platform staff from client-data routes", () => {
    expect(platformMayAccessPath(superAdmin, "/admin/firms")).toBe(true);
    expect(platformMayAccessPath(superAdmin, "/clients")).toBe(false);
    expect(platformMayAccessPath(owner, "/documents?clientId=x")).toBe(false);
    expect(platformMayAccessPath(owner, "/bookkeeping/invoices")).toBe(false);
  });
});

describe("firm isolation", () => {
  it("never allows firm A to read firm B", () => {
    expect(canFirm(adminA, "view", "client", { firmId: "firm-b", clientId: "other" })).toBe(false);
    expect(canFirm(adminB, "view", "document", { firmId: "firm-a" })).toBe(false);
    expect(canFirm(adminA, "view", "client", { firmId: "firm-a", clientId: "client-1" })).toBe(true);
  });

  it("restricts accountants to assigned clients when configured", () => {
    expect(canFirm(accountant, "view", "client", { firmId: "firm-a", assignedUserId: "someone-else" }, { restrictAccountantsToAssigned: true })).toBe(false);
    expect(canFirm(accountant, "view", "client", { firmId: "firm-a", assignedUserId: "a2" }, { restrictAccountantsToAssigned: true })).toBe(true);
    expect(canFirm(accountant, "submit", "vat_return", { firmId: "firm-a" })).toBe(true);
  });

  it("stops staff submitting VAT/ITSA and clients seeing other clients", () => {
    expect(canFirm(staff, "submit", "vat_return", { firmId: "firm-a" })).toBe(false);
    expect(canFirm(staff, "upload", "document", { firmId: "firm-a" })).toBe(true);
    expect(canFirm(client, "view", "client", { firmId: "firm-a", clientId: "client-1" })).toBe(true);
    expect(canFirm(client, "view", "client", { firmId: "firm-a", clientId: "client-2" })).toBe(false);
    expect(canFirm(client, "submit", "vat_return", { firmId: "firm-a", clientId: "client-1" })).toBe(false);
  });

  it("keeps firm users off the platform admin console", () => {
    expect(firmMayAccessPath(adminA, "/admin/firms")).toBe(false);
    expect(firmMayAccessPath(adminA, "/firm/clients")).toBe(true);
    expect(firmMayAccessPath(client, "/firm/clients")).toBe(false);
    expect(firmMayAccessPath(client, "/client/me")).toBe(true);
    expect(firmMayAccessPath(client, "/vat/obligations")).toBe(false);
    expect(firmMayAccessPath(client, "/notifications")).toBe(true);
  });

  it("limits HMRC audit export and digital-link routes to firm admins and accountants", () => {
    expect(firmMayAccessPath(adminA, "/audit/export")).toBe(true);
    expect(firmMayAccessPath(accountant, "/digital-links/vat-1")).toBe(true);
    expect(firmMayAccessPath(staff, "/audit/logs")).toBe(false);
    expect(firmMayAccessPath(client, "/audit/export")).toBe(false);
    expect(platformMayAccessPath(owner, "/audit/export")).toBe(false);
    expect(platformMayAccessPath(superAdmin, "/digital-links/vat-1")).toBe(false);
  });
});
