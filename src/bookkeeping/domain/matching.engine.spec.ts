import { parseBankCsv, parseBankOfx, suggestMatches } from "./matching.engine";

describe("bank matching engine", () => {
  it("parses CSV and OFX feeds", () => {
    const csv = parseBankCsv("date,amount,type,description,externalRef\n2026-04-20,5000,credit,Studio receipts,STAR-1");
    expect(csv).toEqual([
      { date: "2026-04-20", amount: 5000, type: "CREDIT", description: "Studio receipts", externalRef: "STAR-1" },
    ]);
    const ofx = parseBankOfx("<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260318000000<TRNAMT>-40<FITID>X1<NAME>Bank fee");
    expect(ofx[0]).toMatchObject({ date: "2026-03-18", amount: 40, type: "DEBIT", description: "Bank fee" });
  });

  it("suggests a match on amount, date and description", () => {
    const suggestions = suggestMatches(
      [
        {
          id: "txn-1",
          date: "2026-04-20",
          amount: 5000,
          type: "CREDIT",
          description: "Banked studio receipts",
          status: "UNMATCHED",
        },
      ],
      [{ id: "j-1", date: "2026-04-20", description: "Banked studio receipts", total: 5000 }],
    );
    expect(suggestions[0]).toMatchObject({ bankTransactionId: "txn-1", journalEntryId: "j-1" });
    expect(suggestions[0].score).toBeGreaterThan(80);
  });
});
