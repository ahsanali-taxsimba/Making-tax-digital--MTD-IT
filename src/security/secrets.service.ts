import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const REQUIRED_IN_PRODUCTION = [
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "TOKEN_ENCRYPTION_KEY",
  "DATABASE_URL",
];

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

  private assertProductionSecrets() {
    if (this.config.get<string>("nodeEnv") !== "production") {
      return;
    }
    const missing = REQUIRED_IN_PRODUCTION.filter((name) => !this.get(name) || this.get(name).includes("change-me"));
    if (missing.length) {
      this.logger.error(`Production secrets missing: ${missing.join(", ")}`);
      throw new InternalServerErrorException("Production secrets are not configured");
    }
  }
}
