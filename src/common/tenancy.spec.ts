import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthUser } from "./types";
import { assertClientScope, assertFirmAccess } from "./tenancy";

const accountant = (firmId: string): AuthUser => ({
  id: "u1",
  email: "a@example.com",
  role: UserRole.ACCOUNTANT,
  firmId,
  clientId: null,
  name: "Alex",
});

describe("tenancy", () => {
  it("blocks cross-firm access", () => {
    expect(() => assertFirmAccess(accountant("firm-a"), "firm-b")).toThrow(ForbiddenException);
  });

  it("stops a client viewing another client", () => {
    const user: AuthUser = { ...accountant("firm-a"), role: UserRole.CLIENT, clientId: "c1" };
    expect(() => assertClientScope(user, { id: "c2", firmId: "firm-a" })).toThrow(ForbiddenException);
  });

  it("allows an accountant to view a firm client", () => {
    expect(() => assertClientScope(accountant("firm-a"), { id: "c1", firmId: "firm-a" })).not.toThrow();
  });
});
