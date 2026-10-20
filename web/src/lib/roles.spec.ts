import {
  canAccessPath,
  canViewAudit,
  canonicalRole,
  homePath,
  practiceNavFor,
  tenantMismatch,
  tenantQuery,
  withTenantQuery,
} from "./roles";
import type { AuthUser } from "./types";

const owner: AuthUser = {
  id: "p1",
  email: "o",
  name: "Owen",
  role: "ADMIN",
  firmId: "",
  clientId: null,
  principal: "platform",
  platformRole: "admin_owner",
};

const accountant: AuthUser = {
  id: "a1",
  email: "j",
  name: "James",
  role: "ACCOUNTANT",
  firmId: "firm-a",
  clientId: null,
  principal: "firm",
  firmRole: "firm_accountant",
};

const staff: AuthUser = {
  id: "s1",
  email: "n",
  name: "Noah",
  role: "ASSISTANT",
  firmId: "firm-a",
  clientId: null,
  principal: "firm",
  firmRole: "firm_staff",
};

const client: AuthUser = {
  id: "c1",
  email: "am",
  name: "Amelia",
  role: "CLIENT",
  firmId: "firm-a",
  clientId: "client-1",
  principal: "firm",
  firmRole: "firm_client",
};

describe("role routing", () => {
  it("maps platform, firm, and client users to the right home", () => {
    expect(canonicalRole(owner)).toBe("admin_owner");
    expect(homePath(owner)).toBe("/admin/overview");
    expect(homePath(accountant)).toBe("/practice/dashboard");
    expect(homePath(client)).toBe("/client/home");
  });

  it("keeps each principal inside its own navigation tree", () => {
    expect(canAccessPath(owner, "/admin/firms")).toBe(true);
    expect(canAccessPath(owner, "/practice/clients")).toBe(false);
    expect(canAccessPath(owner, "/client/home")).toBe(false);
    expect(canAccessPath(accountant, "/admin/firms")).toBe(false);
    expect(canAccessPath(accountant, "/practice/vat")).toBe(true);
    expect(canAccessPath(accountant, "/practice/audit")).toBe(true);
    expect(canAccessPath(staff, "/practice/vat")).toBe(true);
    expect(canAccessPath(staff, "/practice/audit")).toBe(false);
    expect(canAccessPath(client, "/practice/clients")).toBe(false);
    expect(canAccessPath(client, "/practice/audit")).toBe(false);
    expect(canAccessPath(client, "/client/documents")).toBe(true);
  });

  it("flags cross-tenant route params", () => {
    expect(tenantMismatch(accountant, { firmId: "firm-b" })).toBe(true);
    expect(tenantMismatch(accountant, { firmId: "firm-a" })).toBe(false);
    expect(tenantMismatch(client, { clientId: "client-2" })).toBe(true);
    expect(tenantMismatch(client, { clientId: "client-1" })).toBe(false);
    expect(tenantMismatch(owner, { firmId: "firm-a" })).toBe(true);
  });

  it("never attaches another tenant id to API queries", () => {
    expect(tenantQuery(owner)).toEqual({});
    expect(tenantQuery(accountant)).toEqual({ firmId: "firm-a" });
    expect(tenantQuery(client)).toEqual({ clientId: "client-1" });
    expect(withTenantQuery("/firm/clients", accountant, { firmId: "firm-b" })).toBe("/firm/clients?firmId=firm-a");
    expect(withTenantQuery("/client/documents", client, { clientId: "client-2" })).toBe("/client/documents?clientId=client-1");
    expect(withTenantQuery("/firm/clients?firmId=firm-b", accountant)).toBe("/firm/clients?firmId=firm-a");
    expect(withTenantQuery("/admin/firms?firmId=firm-a&clientId=client-1", owner)).toBe("/admin/firms");
  });

  it("limits the audit viewer to firm admins and accountants", () => {
    expect(canViewAudit("firm_admin")).toBe(true);
    expect(canViewAudit("firm_accountant")).toBe(true);
    expect(canViewAudit("firm_staff")).toBe(false);
    expect(practiceNavFor("firm_accountant").some((item) => item.href === "/practice/audit")).toBe(true);
    expect(practiceNavFor("firm_staff").some((item) => item.href === "/practice/audit")).toBe(false);
  });
});
