import { ManualStatementStatus } from "@prisma/client";
import { ManualStatementsService } from "./manual-statements.service";
import { StatementCSVParserService } from "./statement-csv-parser.service";
import { CsvHealthCheckService } from "./csv-health-check.service";
import { EnrichmentService } from "./enrichment.service";
import { MANUAL_ERR, ManualStatementError } from "./manual-statements.errors";

describe("ManualStatementsService", () => {
  const repo = { create: jest.fn(), find: jest.fn(), list: jest.fn(), mark: jest.fn() };
  const books = { findBankAccount: jest.fn(), listExternalRefs: jest.fn(), createBankTransactions: jest.fn() };
  const clients = { get: jest.fn() };
  const pipeline = { processIngestedFeed: jest.fn() };
  const audit = { record: jest.fn() };
  const service = new ManualStatementsService(
    repo as never,
    books as never,
    clients as never,
    new StatementCSVParserService(),
    new CsvHealthCheckService(),
    new EnrichmentService(),
    pipeline as never,
    audit as never,
  );
  const actor = { id: "u1", role: "ADMIN", firmId: "f1", clientId: null, name: "Priya", email: "p" } as never;
  const account = { id: "ba1", clientId: "c1", firmId: "f1" };
  const csv = "Date,Memo,Amount\n20/01/2026,INV-1001 Brighton Gallery,7200\n21/01/2026,BP Fuel,-48.00";

  beforeEach(() => {
    jest.clearAllMocks();
    books.findBankAccount.mockResolvedValue(account);
    clients.get.mockResolvedValue({ id: "c1", firmId: "f1" });
    books.listExternalRefs.mockResolvedValue([]);
    books.createBankTransactions.mockResolvedValue({ count: 2 });
    repo.create.mockImplementation(async ({ data, ...rest }: { data?: unknown } & Record<string, unknown>) => ({
      id: "up1",
      clientId: "c1",
      bankAccountId: "ba1",
      fileName: "barclays.csv",
      fileType: "csv",
      uploadedByUserId: "u1",
      uploadedAt: new Date("2026-01-22"),
      parsedAt: null,
      status: ManualStatementStatus.UPLOADED,
      content: csv,
      ...rest,
    }));
    repo.find.mockResolvedValue({
      id: "up1",
      clientId: "c1",
      bankAccountId: "ba1",
      fileName: "barclays.csv",
      content: csv,
      status: ManualStatementStatus.UPLOADED,
    });
    repo.mark.mockImplementation(async (_id: string, status: ManualStatementStatus, data: Record<string, unknown>) => ({
      id: "up1",
      clientId: "c1",
      bankAccountId: "ba1",
      fileName: "barclays.csv",
      fileType: "csv",
      uploadedByUserId: "u1",
      uploadedAt: new Date("2026-01-22"),
      status,
      ...data,
    }));
    pipeline.processIngestedFeed.mockResolvedValue({
      matching: { suggestions: [{ id: "m1" }], count: 1, applied: [], journals: 0 },
      categorisation: { suggestions: [{ id: "c1" }], count: 1, applied: [], journals: 0 },
      reconciliation: [{ sessionId: "sess-1" }],
      journals: { posted: 0 },
      vat: { box1: 1200, box6: 6000 },
      itsa: { incomes: { turnover: 7200 } },
    });
  });

  it("rejects non-CSV uploads before storing metadata", async () => {
    await expect(
      service.upload(actor, { bankAccountId: "ba1", fileName: "statement.pdf", csv: "%PDF" }),
    ).rejects.toMatchObject({ errorCode: MANUAL_ERR.FILE_TYPE });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("stores metadata then parses, enriches, and runs the shared pipeline", async () => {
    const result = await service.upload(actor, {
      clientId: "c1",
      bankAccountId: "ba1",
      fileName: "barclays.csv",
      csv,
    });
    if (result.parsed !== true) {
      throw new Error("expected upload to auto-parse");
    }
    expect(result.upload.status).toBe("parsed");
    expect(result.imported).toBe(2);
    expect(books.createBankTransactions).toHaveBeenCalledWith(
      "ba1",
      expect.arrayContaining([
        expect.objectContaining({
          type: "CREDIT",
          amount: 7200,
          merchantName: expect.stringMatching(/Brighton Gallery/i),
          externalRef: expect.stringMatching(/^csv:/),
        }),
        expect.objectContaining({
          type: "DEBIT",
          amount: 48,
          merchantCategoryCode: "5541",
        }),
      ]),
    );
    expect(pipeline.processIngestedFeed).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        clientId: "c1",
        bankAccountId: "ba1",
        source: "manual_csv",
        from: "2026-01-20",
        to: "2026-01-21",
      }),
    );
    expect(result.pipeline.vat.box1).toBe(1200);
    expect(result.pipeline.reconciliation[0].sessionId).toBe("sess-1");
  });

  it("skips rows already imported via the date+amount+description hash", async () => {
    const parsed = await service.parse(actor, "up1");
    const ref = books.createBankTransactions.mock.calls[0][1][0].externalRef;
    books.listExternalRefs.mockResolvedValue([{ externalRef: ref }]);
    books.createBankTransactions.mockClear();
    const again = await service.parse(actor, "up1");
    expect(again.imported).toBe(1);
    expect(again.duplicates).toBe(1);
    expect(books.createBankTransactions.mock.calls[0][1]).toHaveLength(1);
  });

  it("lists uploads without the raw CSV payload", async () => {
    repo.list.mockResolvedValue([
      {
        id: "up1",
        clientId: "c1",
        bankAccountId: "ba1",
        fileName: "barclays.csv",
        fileType: "csv",
        uploadedByUserId: "u1",
        uploadedAt: new Date(),
        parsedAt: new Date(),
        status: "PARSED",
        profile: "BARCLAYS",
        rowCount: 2,
        importedCount: 2,
        duplicateCount: 0,
        health: { ok: true },
        errorMessage: null,
      },
    ]);
    const listed = await service.list(actor, { clientId: "c1" });
    expect(listed.count).toBe(1);
    expect(listed.uploads[0].status).toBe("parsed");
    expect(listed.uploads[0]).not.toHaveProperty("content");
  });

  it("exposes bank profiles and a standalone health check", () => {
    expect(service.profiles().profiles.map((row) => row.id)).toEqual(
      expect.arrayContaining(["HSBC", "BARCLAYS", "NATWEST", "SANTANDER"]),
    );
    const health = service.healthCheck({ fileName: "hsbc.csv", csv });
    expect(health.validCount).toBe(2);
    expect(health.preview).toHaveLength(2);
  });
});

describe("ManualStatementError", () => {
  it("carries a stable error code", () => {
    const error = new ManualStatementError(MANUAL_ERR.FILE_TYPE, "nope");
    expect(error.errorCode).toBe("MANUAL_ERR_FILE_TYPE");
  });
});
