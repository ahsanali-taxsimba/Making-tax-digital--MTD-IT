import { UnauthorizedException } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";
import { JwtStrategy } from "./jwt.strategy";

describe("JwtStrategy", () => {
  const prisma = {
    platformUser: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const config = { get: () => "access-secret" };
  const strategy = new JwtStrategy(config as never, prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects MFA challenge tokens even when they share a user id", async () => {
    await expect(
      strategy.validate({
        sub: "user-1",
        principal: "firm",
        purpose: "mfa",
        firmId: "firm-1",
        clientId: null,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("loads an active firm user for an access token", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "marco.r@example.org",
      role: UserRole.ADMIN,
      firmId: "firm-1",
      clientId: null,
      name: "Priya",
      status: UserStatus.ACTIVE,
    });
    const user = await strategy.validate({
      sub: "user-1",
      principal: "firm",
      purpose: "access",
      firmId: "firm-1",
      clientId: null,
    });
    expect(user.firmId).toBe("firm-1");
    expect(user.firmRole).toBe("firm_admin");
  });
});
