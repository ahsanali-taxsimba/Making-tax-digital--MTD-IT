import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { publicFirmRole, publicPlatformRole } from "../authorization/domain/roles";
import { AuthUser, JwtPayload } from "../common/types";
import { AlertsService } from "../security/alerts.service";
import { MetricsService } from "../security/metrics.service";
import { MfaService } from "../security/mfa.service";
import { PasswordHasher } from "../security/password-hasher";
import { PlatformRole, UserRole } from "@prisma/client";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly hasher: PasswordHasher,
    private readonly mfa: MfaService,
    private readonly alerts: AlertsService,
    private readonly metrics: MetricsService,
  ) {}

  async login(email: string, password: string) {
    const normalised = email.toLowerCase();
    const platform = await this.prisma.platformUser.findUnique({ where: { email: normalised } });
    if (platform) {
      if (!platform.passwordHash || !platform.isActive) {
        await this.failLogin(normalised, "platform");
      }
      const ok = await this.hasher.verify(password, platform.passwordHash!);
      if (!ok) {
        await this.failLogin(normalised, "platform");
      }
      await this.maybeRehash("platform", platform.id, password, platform.passwordHash!);
      const user = this.toPlatformAuthUser(platform);
      return this.afterPassword(user, { kind: "platform", row: platform });
    }
    const user = await this.prisma.user.findUnique({ where: { email: normalised } });
    if (!user?.passwordHash || user.status !== "ACTIVE") {
      await this.failLogin(normalised, "firm");
    }
    const ok = await this.hasher.verify(password, user!.passwordHash!);
    if (!ok) {
      await this.failLogin(normalised, "firm");
    }
    await this.maybeRehash("firm", user!.id, password, user!.passwordHash!);
    const authUser = this.toAuthUser(user!);
    return this.afterPassword(authUser, { kind: "firm", row: user! });
  }

  async verifyMfa(mfaChallengeToken: string, code: string) {
    const challenge = await this.mfa.readChallenge(mfaChallengeToken, "mfa");
    const account = await this.loadAccount(challenge.sub, challenge.principal);
    this.assertMfaNotLocked(account.mfaFailedCount);
    if (!account.mfaEnabled || !account.mfaSecretEnc) {
      await this.failMfa(account.id, challenge.principal);
    }
    if (!this.mfa.verifyCode(account.mfaSecretEnc!, code)) {
      await this.failMfa(account.id, challenge.principal);
    }
    await this.resetMfaFailures(challenge.principal, account.id);
    const tokens = challenge.principal === "platform" ? await this.issuePlatformTokens(account.platform!) : await this.issueTokens(account.firm!);
    const user = challenge.principal === "platform" ? this.toPlatformAuthUser(account.platform!) : this.toAuthUser(account.firm!);
    await this.audit.record({
      actor: user,
      actionType: "auth.login",
      metadata: { email: user.email, principal: user.principal, mfa: true },
    });
    this.metrics.inc("mtd_auth_login_total", { principal: String(user.principal), mfa: "true" });
    return { ...tokens, user };
  }

  async setupMfa(mfaChallengeToken: string) {
    const challenge = await this.mfa.readChallenge(mfaChallengeToken, "mfa-enroll");
    const account = await this.loadAccount(challenge.sub, challenge.principal);
    const enrollment = this.mfa.startEnrollment(account.email);
    if (challenge.principal === "platform") {
      await this.prisma.platformUser.update({ where: { id: account.id }, data: { mfaSecretEnc: enrollment.secretEnc } });
    } else {
      await this.prisma.user.update({ where: { id: account.id }, data: { mfaSecretEnc: enrollment.secretEnc } });
    }
    return { otpauthUrl: enrollment.otpauthUrl, secret: enrollment.secret };
  }

  async confirmMfa(mfaChallengeToken: string, code: string) {
    const challenge = await this.mfa.readChallenge(mfaChallengeToken, "mfa-enroll");
    const account = await this.loadAccount(challenge.sub, challenge.principal);
    this.assertMfaNotLocked(account.mfaFailedCount);
    if (!account.mfaSecretEnc || !this.mfa.verifyCode(account.mfaSecretEnc, code)) {
      await this.failMfa(account.id, challenge.principal);
    }
    const enrolledAt = new Date();
    if (challenge.principal === "platform") {
      await this.prisma.platformUser.update({
        where: { id: account.id },
        data: { mfaEnabled: true, mfaEnrolledAt: enrolledAt, mfaFailedCount: 0 },
      });
      account.platform!.mfaEnabled = true;
    } else {
      await this.prisma.user.update({
        where: { id: account.id },
        data: { mfaEnabled: true, mfaEnrolledAt: enrolledAt, mfaFailedCount: 0 },
      });
      account.firm!.mfaEnabled = true;
    }
    const tokens = challenge.principal === "platform" ? await this.issuePlatformTokens(account.platform!) : await this.issueTokens(account.firm!);
    const user = challenge.principal === "platform" ? this.toPlatformAuthUser(account.platform!) : this.toAuthUser(account.firm!);
    await this.audit.record({
      actor: user,
      actionType: "auth.mfa.enrolled",
      resourceType: "user",
      resourceId: user.id,
      metadata: { principal: user.principal },
    });
    return { ...tokens, user };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const platformStored = await this.prisma.platformRefreshToken.findUnique({
      where: { tokenHash },
      include: { platformUser: true },
    });
    if (platformStored) {
      if (platformStored.revokedAt || platformStored.expiresAt < new Date() || !platformStored.platformUser.isActive) {
        throw new UnauthorizedException("Refresh token is invalid");
      }
      await this.prisma.platformRefreshToken.update({ where: { id: platformStored.id }, data: { revokedAt: new Date() } });
      return this.issuePlatformTokens(platformStored.platformUser);
    }
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.user.status !== "ACTIVE") {
      throw new UnauthorizedException("Refresh token is invalid");
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.user);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await Promise.all([
      this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.platformRefreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.record({ actionType: "auth.logout", metadata: {} });
    return { success: true };
  }

  ssoProviders() {
    return { providers: [] as string[], note: "OAuth2 / SSO placeholder for future IdP integration" };
  }

  private async afterPassword(
    user: AuthUser,
    account: { kind: "platform"; row: PlatformRow } | { kind: "firm"; row: FirmRow },
  ) {
    if (this.mfa.enforce() && this.mfa.requiresMfa(user)) {
      const enrolled = Boolean(account.row.mfaEnabled && account.row.mfaSecretEnc);
      const purpose = enrolled ? "mfa" : "mfa-enroll";
      const mfaChallengeToken = await this.mfa.challengeToken({ id: user.id, principal: user.principal ?? "firm" }, purpose);
      return {
        mfaRequired: true,
        mfaEnrollmentRequired: !enrolled,
        mfaChallengeToken,
        user: { id: user.id, email: user.email, principal: user.principal, role: user.role },
      };
    }
    await this.audit.record({
      actor: user,
      actionType: "auth.login",
      metadata: { email: user.email, principal: user.principal ?? "firm" },
    });
    this.metrics.inc("mtd_auth_login_total", { principal: String(user.principal ?? "firm"), mfa: "false" });
    const tokens = account.kind === "platform" ? await this.issuePlatformTokens(account.row) : await this.issueTokens(account.row);
    return { ...tokens, user };
  }

  private async failLogin(email: string, principal: string): Promise<never> {
    this.alerts.loginFailed(email, { principal });
    this.metrics.inc("mtd_auth_login_failures_total", { principal });
    await this.audit.record({
      actionType: "auth.login_failed",
      metadata: { email, principal },
    });
    throw new UnauthorizedException("Invalid credentials");
  }

  private async failMfa(userId: string, principal: "platform" | "firm"): Promise<never> {
    this.alerts.mfaFailed(userId, { principal });
    this.metrics.inc("mtd_mfa_failures_total", { principal });
    if (principal === "platform") {
      await this.prisma.platformUser.update({ where: { id: userId }, data: { mfaFailedCount: { increment: 1 } } });
    } else {
      await this.prisma.user.update({ where: { id: userId }, data: { mfaFailedCount: { increment: 1 } } });
    }
    await this.audit.record({
      actionType: "auth.mfa_failed",
      resourceType: "user",
      resourceId: userId,
      metadata: { principal },
    });
    throw new UnauthorizedException("Invalid MFA code");
  }

  private async resetMfaFailures(principal: "platform" | "firm", id: string) {
    if (principal === "platform") {
      await this.prisma.platformUser.update({ where: { id }, data: { mfaFailedCount: 0 } });
    } else {
      await this.prisma.user.update({ where: { id }, data: { mfaFailedCount: 0 } });
    }
  }

  private async maybeRehash(kind: "platform" | "firm", id: string, password: string, stored: string) {
    if (!this.hasher.needsRehash(stored)) {
      return;
    }
    const passwordHash = await this.hasher.hash(password);
    if (kind === "platform") {
      await this.prisma.platformUser.update({ where: { id }, data: { passwordHash } });
    } else {
      await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    }
  }

  private async loadAccount(id: string, principal: "platform" | "firm") {
    if (principal === "platform") {
      const platform = await this.prisma.platformUser.findUnique({ where: { id } });
      if (!platform?.isActive) {
        throw new UnauthorizedException("Account is not active");
      }
      return {
        id: platform.id,
        email: platform.email,
        mfaEnabled: platform.mfaEnabled,
        mfaSecretEnc: platform.mfaSecretEnc,
        mfaFailedCount: platform.mfaFailedCount ?? 0,
        platform,
        firm: null,
      };
    }
    const firm = await this.prisma.user.findUnique({ where: { id } });
    if (!firm || firm.status !== "ACTIVE") {
      throw new UnauthorizedException("Account is not active");
    }
    return {
      id: firm.id,
      email: firm.email,
      mfaEnabled: firm.mfaEnabled,
      mfaSecretEnc: firm.mfaSecretEnc,
      mfaFailedCount: firm.mfaFailedCount ?? 0,
      platform: null,
      firm,
    };
  }

  private assertMfaNotLocked(failedCount: number) {
    if (failedCount >= 5) {
      throw new UnauthorizedException("MFA is locked after too many failed attempts");
    }
  }

  private async issueTokens(user: FirmRow) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      firmId: user.firmId,
      clientId: user.clientId,
      principal: "firm",
      firmRole: this.toAuthUser(user).firmRole,
      purpose: "access",
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>("jwt.accessSecret") ?? "dev-access-secret",
      expiresIn: (this.config.get<string>("jwt.accessTtl") ?? "15m") as `${number}${"s" | "m" | "h" | "d"}`,
    });
    const refreshToken = randomBytes(48).toString("hex");
    const days = this.config.get<number>("jwt.refreshTtlDays") ?? 7;
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      },
    });
    return { accessToken, refreshToken, tokenType: "Bearer" as const };
  }

  private async issuePlatformTokens(user: PlatformRow) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      firmId: null,
      clientId: null,
      principal: "platform",
      platformRole: publicPlatformRole(user.role),
      purpose: "access",
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>("jwt.accessSecret") ?? "dev-access-secret",
      expiresIn: (this.config.get<string>("jwt.accessTtl") ?? "15m") as `${number}${"s" | "m" | "h" | "d"}`,
    });
    const refreshToken = randomBytes(48).toString("hex");
    const days = this.config.get<number>("jwt.refreshTtlDays") ?? 7;
    await this.prisma.platformRefreshToken.create({
      data: {
        platformUserId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      },
    });
    return { accessToken, refreshToken, tokenType: "Bearer" as const };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private toAuthUser(user: FirmRow): AuthUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firmId: user.firmId,
      clientId: user.clientId,
      name: user.name,
      principal: "firm",
      firmRole: publicFirmRole(user.role),
      isActive: true,
    };
  }

  private toPlatformAuthUser(user: PlatformRow): AuthUser {
    return {
      id: user.id,
      email: user.email,
      role: UserRole.ADMIN,
      firmId: "",
      clientId: null,
      name: user.name,
      principal: "platform",
      platformRole: publicPlatformRole(user.role),
      isActive: user.isActive,
    };
  }
}

type FirmRow = {
  id: string;
  email: string;
  role: AuthUser["role"];
  firmId: string;
  clientId: string | null;
  name: string;
  status: string;
  mfaEnabled?: boolean | null;
  mfaSecretEnc?: string | null;
  mfaFailedCount?: number | null;
};

type PlatformRow = {
  id: string;
  email: string;
  role: PlatformRole;
  name: string;
  isActive: boolean;
  mfaEnabled?: boolean | null;
  mfaSecretEnc?: string | null;
  mfaFailedCount?: number | null;
};
