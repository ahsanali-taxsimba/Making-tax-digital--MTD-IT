import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

@Injectable()
export class TokenCryptoService {
  constructor(private readonly config: ConfigService) {}

  encrypt(plaintext: string): string {
    const key = this.key();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
  }

  decrypt(payload: string): string {
    const key = this.key();
    const buffer = Buffer.from(payload, "base64");
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = buffer.subarray(IV_LENGTH + 16);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  }

  private key(): Buffer {
    const hex = this.config.get<string>("tokenEncryptionKey") ?? "";
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new InternalServerErrorException("TOKEN_ENCRYPTION_KEY must be 32 bytes encoded as 64 hex characters");
    }
    return Buffer.from(hex, "hex");
  }
}
