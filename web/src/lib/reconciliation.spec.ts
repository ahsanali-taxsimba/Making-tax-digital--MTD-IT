import { maskAccountNumber, reconciliationProgress, statusLabel } from "./reconciliation";

describe("reconciliation helpers", () => {
  it("computes progress from unmatched lines", () => {
    expect(reconciliationProgress({ transactionCount: 10, unmatchedCount: 4 })).toBe(60);
    expect(reconciliationProgress({ transactionCount: 0, unmatchedCount: 0 })).toBe(100);
  });

  it("masks account numbers and labels statuses", () => {
    expect(maskAccountNumber("12345678")).toBe("•••• 5678");
    expect(statusLabel("UNMATCHED")).toBe("Unmatched");
    expect(statusLabel("MATCHED")).toBe("Matched");
  });
});
