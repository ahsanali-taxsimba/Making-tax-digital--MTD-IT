import { ConfigService } from "@nestjs/config";
import { TokenCryptoService } from "./token-crypto.service";

describe("TokenCryptoService", () => {
  const key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const service = new TokenCryptoService({
    get: (name: string) => (name === "tokenEncryptionKey" ? key : undefined),
  } as unknown as ConfigService);

  it("round-trips HMRC tokens", () => {
    const token = "QGbWG8KckncuwwD4uYXgWxF4HQvuPmrmUqKgkpQP";
    const encrypted = service.encrypt(token);
    expect(encrypted).not.toContain(token);
    expect(service.decrypt(encrypted)).toBe(token);
  });

  it("produces different ciphertext for the same token", () => {
    const first = service.encrypt("refresh-token");
    const second = service.encrypt("refresh-token");
    expect(first).not.toBe(second);
  });
});
