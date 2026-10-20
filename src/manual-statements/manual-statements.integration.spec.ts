import { ManualStatementStatus } from "@prisma/client";
import { CsvHealthCheckService } from "./csv-health-check.service";
import { EnrichmentService } from "./enrichment.service";
import { ManualStatementsService } from "./manual-statements.service";
import { StatementCSVParserService } from "./statement-csv-parser.service";

describe("manual CSV bank-feed integration", () => {
  it("reuses matching, categorisation, reconciliation, journals, and VAT/ITSA after parse", async () => {
    const order: string[] = [];
    const csv = [
      "Date, Type, Details, Paid out, Paid in, Balance",
      "20/01/2026,VIS,BRIGHTON GALLERY LTD INV-1001,,7200.00,12000.00",
      "21/01/2026,VIS,BP FUEL,48.00,,11952.00",
    ].join("\n");
    const repo = {
      create: jest.fn().mockResolvedValue({
        id: "up1",
        clientId: "c1",
        bankAccountId: "ba1",
        fileName: "hsbc.csv",
        fileType: "csv",
        uploadedByUserId: "u1",
        uploadedAt: new Date(),
        status: ManualStatementStatus.UPLOADED,
      }),
      find: jest.fn().mockResolvedValue({
        id: "up1",
        clientId: "c1",
        bankAccountId: "ba1",
        fileName: "hsbc.csv",
        content: csv,
      }),
      mark: jest.fn().mockResolvedValue({
        id: "up1",
        clientId: "c1",
        bankAccountId: "ba1",
        fileName: "hsbc.csv",
        fileType: "csv",
        uploadedByUserId: "u1",
        uploadedAt: new Date(),
        parsedAt: new Date(),
        status: ManualStatementStatus.PARSED,
        profile: "HSBC",
        rowCount: 2,
        importedCount: 2,
        duplicateCount: 0,
      }),
    };
    const books = {
      findBankAccount: jest.fn().mockResolvedValue({ id: "ba1", clientId: "c1", firmId: "f1" }),
      listExternalRefs: jest.fn().mockResolvedValue([]),
      createBankTransactions: jest.fn().mockImplementation(async () => {
        order.push("import");
        return { count: 2 };
      }),
    };
    const pipeline = {
      processIngestedFeed: jest.fn().mockImplementation(async () => {
        order.push("match");
        order.push("categorise");
        order.push("reconcile");
        order.push("vat");
        return {
          matching: { count: 1, suggestions: [{ documentKind: "invoice" }], applied: [], journals: 1 },
          categorisation: { count: 1, suggestions: [{ ledgerCode: 3080 }], applied: [], journals: 1 },
          reconciliation: [{ sessionId: "sess-1", unmatchedCount: 0 }],
          journals: { posted: 2 },
          vat: { box1: 1200, box4: 8, box6: 7200, box7: 40 },
          itsa: { incomes: { turnover: 7200 }, expenses: { motorExpenses: 40 } },
        };
      }),
    };

    const service = new ManualStatementsService(
      repo as never,
      books as never,
      { get: jest.fn().mockResolvedValue({ id: "c1" }) } as never,
      new StatementCSVParserService(),
      new CsvHealthCheckService(),
      new EnrichmentService(),
      pipeline as never,
      { record: jest.fn() } as never,
    );

    const result = await service.upload({ id: "u1" } as never, {
      bankAccountId: "ba1",
      fileName: "hsbc.csv",
      csv,
      autoPost: true,
    });

    expect(order).toEqual(["import", "match", "categorise", "reconcile", "vat"]);
    if (result.parsed !== true) {
      throw new Error("expected upload to auto-parse");
    }
    expect(result.profile).toBe("HSBC");
    expect(result.pipeline.matching.suggestions[0].documentKind).toBe("invoice");
    expect(result.pipeline.vat.box6).toBe(7200);
    expect(result.pipeline.itsa.expenses.motorExpenses).toBe(40);
    expect(pipeline.processIngestedFeed).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ autoPost: true, source: "manual_csv" }),
    );
  });
});
