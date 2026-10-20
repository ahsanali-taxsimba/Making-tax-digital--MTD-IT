import { hashAuditEntry, verifyAuditChain } from "./hash";

describe("hashAuditEntry", () => {
  const base = {
    prevHash: null,
    firmId: "firm-a",
    clientId: "client-1",
    userId: "user-1",
    action: "vat.return.submitted",
    resourceType: "vat_return",
    resourceId: "vat-1",
    beforeData: null,
    afterData: { status: "SUBMITTED" },
    metadata: { periodKey: "26A1" },
    createdAt: "2026-04-06T00:00:00.000Z",
  };

  it("produces a stable SHA-256 hex digest", () => {
    const first = hashAuditEntry(base);
    const second = hashAuditEntry({ ...base });
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(second);
  });

  it("changes when any chained field changes", () => {
    const original = hashAuditEntry(base);
    expect(hashAuditEntry({ ...base, action: "vat.return.failed" })).not.toBe(original);
    expect(hashAuditEntry({ ...base, prevHash: original })).not.toBe(original);
    expect(hashAuditEntry({ ...base, afterData: { status: "DRAFT" } })).not.toBe(original);
  });

  it("accepts a valid hash chain and rejects a broken one", () => {
    const first = hashAuditEntry(base);
    const second = hashAuditEntry({ ...base, prevHash: first, action: "vat.return.fetched" });
    expect(verifyAuditChain([{ prevHash: null, entryHash: first }, { prevHash: first, entryHash: second }])).toBe(true);
    expect(verifyAuditChain([{ prevHash: null, entryHash: first }, { prevHash: "tampered", entryHash: second }])).toBe(false);
  });
});
