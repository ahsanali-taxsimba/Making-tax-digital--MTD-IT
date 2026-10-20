import { UserRole } from "@prisma/client";
import { AuthorizationError } from "./authorization.errors";
import { AuthorizationService } from "./authorization.service";
import type { AuthUser } from "../common/types";

describe("AuthorizationService", () => {
  const authz = new AuthorizationService();
  const owner: AuthUser = {
    id: "p1",
    email: "ivan.p@example.net",
    name: "Owen",
    role: UserRole.ADMIN,
    firmId: "",
    clientId: null,
    principal: "platform",
    platformRole: "admin_owner",
  };
  const firmA: AuthUser = {
    id: "a1",
    email: "marco.r@example.org",
    name: "Priya",
    role: UserRole.ADMIN,
    firmId: "firm-a",
    clientId: null,
    principal: "firm",
    firmRole: "firm_admin",
  };
  const client: AuthUser = {
    id: "c1",
    email: "tom.h@example.org",
    name: "Amelia",
    role: UserRole.CLIENT,
    firmId: "firm-a",
    clientId: "client-1",
    principal: "firm",
    firmRole: "firm_client",
  };

  it("lets a platform owner read aggregated firm stats", () => {
    expect(authz.canPlatform(owner, "view_firm_stats")).toBe(true);
    expect(() => authz.assertPlatform(owner, "view_firm_stats")).not.toThrow();
  });

  it("refuses platform owners any client, document, or bank data", () => {
    expect(() => authz.assertCanAccessClientData(owner, { firmId: "firm-a" })).toThrow(AuthorizationError);
    expect(() => authz.assertRouteAccess(owner, "/clients")).toThrow(AuthorizationError);
    expect(() => authz.assertRouteAccess(owner, "/documents")).toThrow(AuthorizationError);
    expect(() => authz.assertRouteAccess(owner, "/bookkeeping/bank/accounts/x/transactions")).toThrow(AuthorizationError);
  });

  it("blocks firm A from firm B even for admins", () => {
    expect(() => authz.assertFirm(firmA, "view", "client", { firmId: "firm-b", clientId: "c9" })).toThrow(AuthorizationError);
    expect(() => authz.assertFirm(firmA, "view", "client", { firmId: "firm-a", clientId: "c1" })).not.toThrow();
  });

  it("allows a client to see only their own record", () => {
    expect(() => authz.assertFirm(client, "view", "client", { firmId: "firm-a", clientId: "client-1" })).not.toThrow();
    expect(() => authz.assertFirm(client, "view", "client", { firmId: "firm-a", clientId: "client-2" })).toThrow(AuthorizationError);
    expect(() => authz.assertRouteAccess(client, "/firm/clients")).toThrow(AuthorizationError);
  });
});
