import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UserRole, UserStatus } from "@prisma/client";
import { AuthService } from "./auth.service";
import { PasswordHasher } from "../security/password-hasher";

describe("AuthService", () => {
  const hasher = new PasswordHasher();
  let passwordHash: string;
  const user = {
    id: "user-1",
    email: "marco.r@example.org",
    role: UserRole.ADMIN,
    firmId: "firm-1",
    clientId: null,
    name: "Priya",
    status: UserStatus.ACTIVE,
    passwordHash: "",
    mfaEnabled: false,
    mfaSecretEnc: null,
  };

  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    platformUser: { findUnique: jest.fn(), update: jest.fn() },
    refreshToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    platformRefreshToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue("access.jwt") };
  const config = {
    get: (key: string) => {
      if (key === "jwt.refreshTtlDays") return 7;
      if (key === "mfa.enforce") return false;
      if (key === "nodeEnv") return "test";
      return "secret";
    },
  };
  const audit = { record: jest.fn() };
  const mfa = {
    enforce: () => false,
    requiresMfa: () => true,
    challengeToken: jest.fn(),
    readChallenge: jest.fn(),
    verifyCode: jest.fn(),
    startEnrollment: jest.fn(),
  };
  const alerts = { loginFailed: jest.fn(), mfaFailed: jest.fn() };
  const metrics = { inc: jest.fn() };
  let service: AuthService;

  beforeAll(async () => {
    passwordHash = await hasher.hash("PracticeAdmin123!");
    user.passwordHash = passwordHash;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jwt.signAsync.mockResolvedValue("access.jwt");
    mfa.enforce = () => false;
    service = new AuthService(
      prisma as never,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
      audit as never,
      hasher,
      mfa as never,
      alerts as never,
      metrics as never,
    );
  });

  it("rejects unknown users and records a failed-login alert", async () => {
    prisma.platformUser.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login("nobody@example.com", "x")).rejects.toBeInstanceOf(UnauthorizedException);
    expect(alerts.loginFailed).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "auth.login_failed" }));
  });

  it("issues tokens for a valid password when MFA is not enforced", async () => {
    prisma.platformUser.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.refreshToken.create.mockResolvedValue({});
    const result = await service.login(user.email, "PracticeAdmin123!");
    expect(result).toEqual(expect.objectContaining({ accessToken: "access.jwt" }));
    expect((result as { refreshToken: string }).refreshToken).toHaveLength(96);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "auth.login" }));
  });

  it("refuses refresh for a suspended firm user", async () => {
    prisma.platformRefreshToken.findUnique.mockResolvedValue(null);
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { ...user, status: "SUSPENDED" },
    });
    await expect(service.refresh("deadbeef")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("challenges privileged users when MFA is enforced", async () => {
    mfa.enforce = () => true;
    mfa.challengeToken.mockResolvedValue("mfa.jwt");
    prisma.platformUser.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(user);
    const result = await service.login(user.email, "PracticeAdmin123!");
    expect(result).toEqual(
      expect.objectContaining({ mfaRequired: true, mfaEnrollmentRequired: true, mfaChallengeToken: "mfa.jwt" }),
    );
  });
});
