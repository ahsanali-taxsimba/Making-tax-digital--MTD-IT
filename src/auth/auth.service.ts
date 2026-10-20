import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { publicFirmRole, publicPlatformRole } from "../authorization/domain/roles";
import { AuthUser, JwtPayload } from "../common/types";
import { PlatformRole, UserRole } from "@prisma/client";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string) {
    const normalised = email.toLowerCase();
    const platform = await this.prisma.platformUser.findUnique({ where: { email: normalised } });
    if (platform) {
      if (!platform.passwordHash || !platform.isActive) {
        throw new UnauthorizedException("Invalid credentials");
      }
      const ok = await bcrypt.compare(password, platform.passwordHash);
      if (!ok) {
        throw new UnauthorizedException("Invalid credentials");
      }
      const tokens = await this.issuePlatformTokens(platform);
      await this.audit.record({
        actionType: "auth.login",
        metadata: { email: platform.email, principal: "platform", role: platform.role },
      });
      return { ...tokens, user: this.toPlatformAuthUser(platform) };
    }
    const user = await this.prisma.user.findUnique({ where: { email: normalised } });
    if (!user?.passwordHash || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Invalid credentials");
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const tokens = await this.issueTokens(user);
    await this.audit.record({
      actor: this.toAuthUser(user),
      actionType: "auth.login",
      metadata: { email: user.email, principal: "firm" },
    });
    return {
      ...tokens,
      user: this.toAuthUser(user),
    };
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
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
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
    return { success: true };
  }

  ssoProviders() {
    return { providers: [] as string[], note: "OAuth2 / SSO placeholder for future IdP integration" };
  }

  private async issueTokens(user: { id: string; email: string; role: AuthUser["role"]; firmId: string; clientId: string | null; name: string; status: string }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      firmId: user.firmId,
      clientId: user.clientId,
      principal: "firm",
      firmRole: this.toAuthUser(user).firmRole,
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

  private async issuePlatformTokens(user: { id: string; email: string; role: PlatformRole; name: string; isActive: boolean }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      firmId: null,
      clientId: null,
      principal: "platform",
      platformRole: publicPlatformRole(user.role),
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

  private toAuthUser(user: { id: string; email: string; role: AuthUser["role"]; firmId: string; clientId: string | null; name: string }): AuthUser {
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

  private toPlatformAuthUser(user: { id: string; email: string; role: PlatformRole; name: string; isActive: boolean }): AuthUser {
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
