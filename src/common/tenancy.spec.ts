import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { resolveScopedClientId } from "./tenancy";

describe("resolveScopedClientId", () => {
  it("uses the linked client for portal users", () => {
    expect(
      resolveScopedClientId(
        { id: "u", email: "a", role: UserRole.CLIENT, firmId: "f", clientId: "c1", name: "Amelia" },
        undefined,
      ),
    ).toBe("c1");
  });

  it("blocks a client from asking for another client", () => {
    expect(() =>
      resolveScopedClientId(
        { id: "u", email: "a", role: UserRole.CLIENT, firmId: "f", clientId: "c1", name: "Amelia" },
        "c2",
      ),
    ).toThrow(ForbiddenException);
  });

  it("requires staff to pass a client id", () => {
    expect(() =>
      resolveScopedClientId(
        { id: "u", email: "a", role: UserRole.ACCOUNTANT, firmId: "f", clientId: null, name: "Priya" },
        undefined,
      ),
    ).toThrow(BadRequestException);
  });
});
