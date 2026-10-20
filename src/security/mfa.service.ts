import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import { TokenCryptoService } from "../common/crypto/token-crypto.service";
import { AuthUser } from "../common/types";
import { generateTotpSecret, otpauthUrl, verifyTotp } from "./totp";

const PRIVILEGED_FIRM: UserRole[] = [UserRole.ADMIN, UserRole.ACCOUNTANT];
const PRIVILEGED_PLATFORM = new Set(["admin_super", "admin_owner", "admin_developer"]);

export interface MfaAccount {
  id: string;
  email: string;
  mfaEnabled?: boolean | null;
  mfaSecretEnc?: string | null;
}

@Injectable()
export class MfaService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly crypto: TokenCryptoService,
  ) {}

  enforce(): boolean {
    const value = this.config.get<boolean>("mfa.enforce");
    if (typeof value === "boolean") {
      return value;
    }
    return this.config.get<string>("nodeEnv") === "production";
  }

  requiresMfa(user: Pick<AuthUser, "principal" | "role" | "platformRole">): boolean {
    if (user.principal === "platform") {
      return PRIVILEGED_PLATFORM.has(String(user.platformRole ?? ""));
    }
    return PRIVILEGED_FIRM.includes(user.role);
  }

  mfaSecret(): string {
    return (
      this.config.get<string>("jwt.mfaSecret") ||
      this.config.get<string>("jwt.refreshSecret") ||
      "dev-mfa-secret-change-me-please-32chars"
    );
  }

  async challengeToken(user: { id: string; principal: "platform" | "firm" }, purpose: "mfa" | "mfa-enroll") {
    return this.jwt.signAsync(
      { sub: user.id, principal: user.principal, purpose },
      {
        secret: this.mfaSecret(),
        expiresIn: "5m",
      },
    );
  }

  async readChallenge(token: string, purpose: "mfa" | "mfa-enroll") {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; principal: "platform" | "firm"; purpose: string }>(token, {
        secret: this.mfaSecret(),
      });
      if (payload.purpose !== purpose) {
        throw new UnauthorizedException("Invalid MFA challenge");
      }
      return payload;
    } catch {
      throw new UnauthorizedException("MFA challenge expired");
    }
  }

  startEnrollment(email: string) {
    const secret = generateTotpSecret();
    return {
      secret,
      otpauthUrl: otpauthUrl(secret, email),
      secretEnc: this.crypto.encrypt(secret),
    };
  }

  verifyCode(secretEnc: string, code: string): boolean {
    try {
      return verifyTotp(this.crypto.decrypt(secretEnc), code);
    } catch {
      return false;
    }
  }
}
