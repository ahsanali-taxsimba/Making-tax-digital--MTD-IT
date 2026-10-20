import { PasswordHasher } from "./password-hasher";

describe("PasswordHasher", () => {
  const hasher = new PasswordHasher();

  it("hashes with argon2id and verifies", async () => {
    const stored = await hasher.hash("PracticeAdmin123!");
    expect(stored.startsWith("$argon2")).toBe(true);
    expect(await hasher.verify("PracticeAdmin123!", stored)).toBe(true);
    expect(await hasher.verify("wrong-password", stored)).toBe(false);
  });

  it("still verifies legacy bcrypt hashes and marks them for rehash", async () => {
    const bcrypt = await import("bcrypt");
    const stored = await bcrypt.hash("PracticeAdmin123!", 4);
    expect(await hasher.verify("PracticeAdmin123!", stored)).toBe(true);
    expect(hasher.needsRehash(stored)).toBe(true);
  });
});
