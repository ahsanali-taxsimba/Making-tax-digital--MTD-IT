import { parseStatementCsv } from "./csv";
import { healthCheckStatement } from "./health";

describe("CSV health check", () => {
  it("flags missing dates, duplicates, and balance gaps", () => {
    const parsed = parseStatementCsv(
      [
        "Date, Description, Money in, Money out, Balance",
        "20/01/2026,Gallery,7200,,12000",
        ",No date,10,,12010",
        "20/01/2026,Gallery,7200,,12000",
        "21/01/2026,BP,,48,11952",
        "22/01/2026,Tesco,,20,11932",
        "23/01/2026,Cafe,,10,5000",
      ].join("\n"),
    );
    const health = healthCheckStatement(parsed);
    expect(health.issues.some((issue) => issue.code === "MISSING_DATE")).toBe(true);
    expect(health.issues.some((issue) => issue.code === "DUPLICATE_ROW")).toBe(true);
    expect(health.issues.some((issue) => issue.code === "BALANCE_INCONSISTENCY")).toBe(true);
    expect(health.ok).toBe(false);
  });

  it("accepts a consistent oldest-first running balance", () => {
    const parsed = parseStatementCsv(
      [
        "Date, Description, Money in, Money out, Balance",
        "20/01/2026,Gallery,7200,,12000",
        "21/01/2026,BP,,48,11952",
      ].join("\n"),
    );
    expect(healthCheckStatement(parsed).ok).toBe(true);
  });
});
