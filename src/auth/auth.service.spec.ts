import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UserRole, UserStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  const passwordHash = bcrypt.hashSync("PracticeAdmin123!", 4);
  const user = {
    id: "user-1",
    email: "marco.r@example.org",
    role: UserRole.ADMIN,
    firmId: "firm-1",
    clientId: null,
    name: "Priya",
    status: UserStatus.ACTIVE,
    passwordHash,
  };

  const prisma = {
    user: { findUnique: jest.fn() },
    refreshToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue("access.jwt") };
  const config = {
    get: (key: string) => {
      if (key === "jwt.refreshTtlDays") return 7;
      return "secret";
    },
  };
  const audit = { record: jest.fn() };
  const service = new AuthService(prisma as never, jwt as unknown as JwtService, config as unknown as ConfigService, audit as never);

  beforeEach(() => {
    jest.clearAllMocks();
    jwt.signAsync.mockResolvedValue("access.jwt");
  });

  it("rejects unknown users", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login("nobody@example.com", "x")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("issues tokens for a valid password", async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.refreshToken.create.mockResolvedValue({});
    const result = await service.login(user.email, "PracticeAdmin123!");
    expect(result.accessToken).toBe("access.jwt");
    expect(result.refreshToken).toHaveLength(96);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "auth.login" }));
  });
});
