import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const REQUIRED_IN_PRODUCTION = [
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_MFA_SECRET",
  "TOKEN_ENCRYPTION_KEY",
  "DATABASE_URL",
];

const WEAK = /change-me|replace-me|dev-access-secret|dev-refresh-secret|dev-mfa-secret|please-32|password|secret123/i;

@Injectable()
export class SecretsService {
  private readonly logger = new Logger(SecretsService.name);

  constructor(private readonly config: ConfigService) {
    this.assertProductionSecrets();
  }

  get(name: string, fallback = ""): string {
    return process.env[name] || this.config.get<string>(name) || fallback;
  }

  require(name: string): string {
    const value = this.get(name);
    if (!value) {
      throw new InternalServerErrorException(`Missing secret ${name}`);
    }
    return value;
  }

  encryptionKeys(): { current: string; previous?: string } {
    const current = this.get("TOKEN_ENCRYPTION_KEY") || this.config.get<string>("tokenEncryptionKey") || "";
    const previous = this.get("TOKEN_ENCRYPTION_KEY_PREVIOUS") || this.config.get<string>("tokenEncryptionKeyPrevious") || "";
    return { current, previous: previous || undefined };
  }

  isWeak(value: string): boolean {
    if (!value || value.length < 32) {
      return true;
    }
    return WEAK.test(value);
  }

  private assertProductionSecrets() {
    if (this.config.get<string>("nodeEnv") !== "production") {
      return;
    }
    const missing = REQUIRED_IN_PRODUCTION.filter((name) => this.isWeak(this.get(name)));
    const access = this.get("JWT_ACCESS_SECRET");
    const refresh = this.get("JWT_REFRESH_SECRET");
    const mfa = this.get("JWT_MFA_SECRET") || refresh;
    if (access && refresh && access === refresh) {
      missing.push("JWT_ACCESS_SECRET!=JWT_REFRESH_SECRET");
    }
    if (access && mfa && access === mfa) {
      missing.push("JWT_ACCESS_SECRET!=JWT_MFA_SECRET");
    }
    if (missing.length) {
      this.logger.error(`Production secrets missing or weak: ${missing.join(", ")}`);
      throw new InternalServerErrorException("Production secrets are not configured");
    }
  }
}
