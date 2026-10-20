import { JwtService } from "@nestjs/jwt";
import { TokenCryptoService } from "../common/crypto/token-crypto.service";
import { MfaService } from "./mfa.service";
import { totp } from "./totp";
import { UserRole } from "@prisma/client";

describe("MfaService", () => {
  const key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const crypto = new TokenCryptoService({ get: (name: string) => (name === "tokenEncryptionKey" ? key : undefined) } as never);
  const jwt = new JwtService({ secret: "secret" });
  const service = new MfaService(jwt, { get: () => false } as never, crypto);

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
});
