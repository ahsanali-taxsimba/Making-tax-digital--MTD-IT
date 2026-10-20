import { generateTotpSecret, totp, verifyTotp } from "./totp";

describe("TOTP", () => {
  it("accepts the current code and rejects a wrong code", () => {
    const secret = generateTotpSecret();
    const code = totp(secret);
    expect(verifyTotp(secret, code)).toBe(true);
    expect(verifyTotp(secret, "000000")).toBe(false);
  });
});
