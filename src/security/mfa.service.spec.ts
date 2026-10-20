import { JwtService } from "@nestjs/jwt";
import { TokenCryptoService } from "../common/crypto/token-crypto.service";
import { MfaService } from "./mfa.service";
import { totp } from "./totp";
import { UserRole } from "@prisma/client";

describe("MfaService", () => {
  const key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const crypto = new TokenCryptoService({ get: (name: string) => (name === "tokenEncryptionKey" ? key : undefined) } as never);
  const jwt = new JwtService({ secret: "access-secret" });
  const config = {
    get: (key: string) => {
      if (key === "jwt.mfaSecret") return "mfa-secret-key-not-the-access-secret!!";
      if (key === "jwt.accessSecret") return "access-secret";
      return false;
    },
  };
  const service = new MfaService(jwt, config as never, crypto);

  it("requires MFA for firm admins and accountants", () => {
    expect(service.requiresMfa({ principal: "firm", role: UserRole.ADMIN })).toBe(true);
    expect(service.requiresMfa({ principal: "firm", role: UserRole.ACCOUNTANT })).toBe(true);
    expect(service.requiresMfa({ principal: "firm", role: UserRole.ASSISTANT })).toBe(false);
    expect(service.requiresMfa({ principal: "platform", role: UserRole.ADMIN, platformRole: "admin_super" })).toBe(true);
  });

  it("verifies enrollment codes against the encrypted secret", () => {
    const enrollment = service.startEnrollment("marco.r@example.org");
    expect(enrollment.otpauthUrl).toContain("otpauth://totp/");
    expect(service.verifyCode(enrollment.secretEnc, totp(enrollment.secret))).toBe(true);
    expect(service.verifyCode(enrollment.secretEnc, "000000")).toBe(false);
  });

  it("signs MFA challenges with a secret distinct from the access token secret", async () => {
    const token = await service.challengeToken({ id: "user-1", principal: "firm" }, "mfa");
    await expect(jwt.verifyAsync(token, { secret: "access-secret" })).rejects.toBeDefined();
    const payload = await jwt.verifyAsync<{ purpose: string }>(token, { secret: "mfa-secret-key-not-the-access-secret!!" });
    expect(payload.purpose).toBe("mfa");
  });
});

