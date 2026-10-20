import {
  parseMoneyCell,
  parseStatementCsv,
  parseUkDate,
  rejectNonCsv,
  transactionFingerprint,
} from "./csv";

describe("manual statement CSV parser", () => {
  it("rejects PDF, XLSX, images, and binary content", () => {
    expect(rejectNonCsv("statement.pdf", "Date,Amount")).toMatch(/Only \.CSV/);
    expect(rejectNonCsv("statement.xlsx", "Date,Amount")).toMatch(/Only \.CSV/);
    expect(rejectNonCsv("scan.png", "Date,Amount")).toMatch(/Only \.CSV/);
    expect(rejectNonCsv("statement.csv", "%PDF-1.7")).toMatch(/not a CSV/);
    expect(rejectNonCsv("hsbc-january.csv", "Date,Amount\n20/01/2026,10")).toBeNull();
  });

  it("normalises UK dates and sterling amounts", () => {
    expect(parseUkDate("20/01/2026")).toBe("2026-01-20");
    expect(parseUkDate("20-Jan-2026")).toBe("2026-01-20");
    expect(parseUkDate("2026-01-20")).toBe("2026-01-20");
    expect(parseMoneyCell("£1,234.56")).toBe(1234.56);
    expect(parseMoneyCell("(48.00)")).toBe(-48);
    expect(parseMoneyCell("48.00 DR")).toBe(-48);
  });

  it("parses HSBC debit/credit columns", () => {
    const parsed = parseStatementCsv(
      [
        "Date, Type, Details, Paid out, Paid in, Balance",
        "20/01/2026,VIS,BRIGHTON GALLERY LTD,,\"£7,200.00\",\"£12,000.00\"",
        "21/01/2026,VIS,BP FUEL,£48.00,,\"£11,952.00\"",
      ].join("\n"),
    );
    expect(parsed.profile.id).toBe("HSBC");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({ date: "2026-01-20", amount: 7200, type: "CREDIT" });
    expect(parsed.rows[1]).toMatchObject({ date: "2026-01-21", amount: 48, type: "DEBIT" });
  });

  it("parses Barclays signed amounts", () => {
    const parsed = parseStatementCsv("Date,Memo,Amount\n20/01/2026,Studio sales,7200\n21/01/2026,BP Fuel,-48.00");
    expect(parsed.profile.id).toBe("BARCLAYS");
    expect(parsed.rows[0].type).toBe("CREDIT");
    expect(parsed.rows[1].type).toBe("DEBIT");
  });

  it("parses NatWest value + type", () => {
    const parsed = parseStatementCsv(
      "Date, Type, Description, Value, Balance\n20/01/2026,CR,Studio sales,7200.00,12000\n21/01/2026,DR,BP Fuel,48.00,11952",
    );
    expect(parsed.profile.id).toBe("NATWEST");
    expect(parsed.rows[0].type).toBe("CREDIT");
    expect(parsed.rows[1].type).toBe("DEBIT");
  });

  it("parses Santander money in/out", () => {
    const parsed = parseStatementCsv(
      "Date, Description, Money in, Money out, Balance\n20/01/2026,Brighton Gallery,7200,,12000\n21/01/2026,BP,,48,11952",
    );
    expect(parsed.profile.id).toBe("SANTANDER");
    expect(parsed.rows.map((row) => row.type)).toEqual(["CREDIT", "DEBIT"]);
  });

  it("hashes date + amount + description for externalTransactionId", () => {
    const left = transactionFingerprint("2026-01-20", 7200, "Brighton Gallery");
    const right = transactionFingerprint("2026-01-20", 7200, "brighton gallery");
    const other = transactionFingerprint("2026-01-21", 7200, "Brighton Gallery");
    expect(left).toBe(right);
    expect(left).not.toBe(other);
    expect(left).toHaveLength(32);
  });
});
