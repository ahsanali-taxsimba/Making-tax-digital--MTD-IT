import { NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { AuthUser } from "../common/types";
import { DigitalLinksService } from "./digital-links.service";

describe("DigitalLinksService", () => {
  const prisma = {
    documentFile: { findFirst: jest.fn() },
    bankTransaction: { findFirst: jest.fn() },
    journalEntry: { findFirst: jest.fn() },
    salesInvoice: { findFirst: jest.fn(), findMany: jest.fn() },
    vatReturn: { findFirst: jest.fn(), findMany: jest.fn() },
    itsaUpdate: { findFirst: jest.fn(), findMany: jest.fn() },
    itsaEndOfPeriodStatement: { findFirst: jest.fn() },
    itsaFinalDeclaration: { findFirst: jest.fn() },
  };
  const authz = { assertCanAccessClientData: jest.fn() };
  const service = new DigitalLinksService(prisma as never, authz as never);
  const user: AuthUser = {
    id: "u1",
    email: "james@northbridge.test",
    name: "James",
    role: UserRole.ACCOUNTANT,
    firmId: "firm-a",
    clientId: null,
    principal: "firm",
    firmRole: "firm_accountant",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.documentFile.findFirst.mockResolvedValue(null);
    prisma.bankTransaction.findFirst.mockResolvedValue(null);
    prisma.journalEntry.findFirst.mockResolvedValue(null);
    prisma.salesInvoice.findFirst.mockResolvedValue(null);
    prisma.salesInvoice.findMany.mockResolvedValue([]);
    prisma.vatReturn.findFirst.mockResolvedValue(null);
    prisma.vatReturn.findMany.mockResolvedValue([]);
    prisma.itsaUpdate.findFirst.mockResolvedValue(null);
    prisma.itsaUpdate.findMany.mockResolvedValue([]);
    prisma.itsaEndOfPeriodStatement.findFirst.mockResolvedValue(null);
    prisma.itsaFinalDeclaration.findFirst.mockResolvedValue(null);
  });

  it("builds Document → Bank → Journal → VAT from a document", async () => {
    prisma.documentFile.findFirst.mockResolvedValue({
      id: "doc-1",
      firmId: "firm-a",
      clientId: "client-1",
      fileName: "tesco-receipt.pdf",
      extractedData: null,
      extractionStatus: "NOT_STARTED",
      extractionConfidence: null,
      bankTransaction: { id: "txn-1", description: "TESCO STORES", matchedJournal: { id: "j1", reference: "J-100", clientId: "client-1", date: new Date("2026-05-01") } },
      journal: { id: "j1", reference: "J-100", clientId: "client-1", date: new Date("2026-05-01") },
      invoice: null,
      vatReturn: { id: "vat-1", periodKey: "26A1", status: "SUBMITTED", formBundleNumber: "FB1", correlationId: "c1", periodStart: new Date("2026-04-01"), periodEnd: new Date("2026-06-30") },
      itsaSubmission: null,
    });

    const links = await service.build(user, "doc-1", "vat");
    expect(authz.assertCanAccessClientData).toHaveBeenCalledWith(user, { firmId: "firm-a" });
    expect(links.chain).toBe("vat");
    expect(links.path).toEqual(["document", "bankTransaction", "journalEntry", "vatReturn"]);
    expect(links.document.linked).toBe(true);
    expect(links.bankTransaction.linked).toBe(true);
    expect(links.journalEntry.linked).toBe(true);
    expect(links.vatReturn.linked).toBe(true);
    expect(links.vatReturn.detail).toMatchObject({ periodKey: "26A1", hmrcSubmissionId: "FB1" });
    expect(links.vatReturn.detail).toMatchObject({ box1: expect.any(Number), box5: expect.any(Number) });
  });

  it("builds Document → Extraction → Invoice → VAT", async () => {
    prisma.documentFile.findFirst.mockResolvedValue({
      id: "doc-2",
      firmId: "firm-a",
      clientId: "client-1",
      fileName: "invoice.pdf",
      extractedData: { supplier: "Acme", total: 120 },
      extractionStatus: "COMPLETED",
      extractionConfidence: 0.94,
      bankTransaction: null,
      journal: null,
      invoice: { id: "inv-1", invoiceNumber: "INV-88", clientId: "client-1", date: new Date("2026-05-12") },
      vatReturn: { id: "vat-1", periodKey: "26A1", status: "SUBMITTED", formBundleNumber: "FB1", correlationId: "c1" },
      itsaSubmission: null,
    });

    const links = await service.build(user, "doc-2", "invoice");
    expect(links.path).toEqual(["document", "extraction", "invoice", "vatReturn"]);
    expect(links.extraction.linked).toBe(true);
    expect(links.invoice.linked).toBe(true);
    expect(links.invoice.label).toBe("INV-88");
    expect(links.vatReturn.linked).toBe(true);
  });

  it("walks backwards from a VAT return and stays inside the firm", async () => {
    prisma.vatReturn.findFirst.mockResolvedValue({
      id: "vat-1",
      periodKey: "26A1",
      status: "SUBMITTED",
      clientId: "client-1",
      formBundleNumber: "FB1",
    });
    prisma.documentFile.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "doc-9",
        firmId: "firm-a",
        fileName: "linked.pdf",
        extractedData: null,
        bankTransaction: { id: "txn-9", description: "HMRC VAT" },
        journal: { id: "j9", reference: "J-VAT" },
        invoice: null,
        vatReturn: { id: "vat-1", periodKey: "26A1", status: "SUBMITTED", formBundleNumber: "FB1" },
        itsaSubmission: null,
      });

    const links = await service.build(user, "vat-1", "vat");
    expect(prisma.vatReturn.findFirst).toHaveBeenCalledWith({ where: { id: "vat-1", client: { firmId: "firm-a" } } });
    expect(links.document.id).toBe("doc-9");
    expect(links.vatReturn.id).toBe("vat-1");
  });

  it("builds Document → Bank → Journal → Quarterly → EOPS → Final", async () => {
    prisma.documentFile.findFirst.mockResolvedValue({
      id: "doc-itsa",
      firmId: "firm-a",
      clientId: "client-1",
      fileName: "uber-receipt.pdf",
      extractedData: { supplier: "Uber" },
      extractionStatus: "COMPLETED",
      extractionConfidence: 0.9,
      bankTransaction: { id: "txn-itsa", description: "UBER TRIP", matchedJournal: { id: "j-itsa", reference: "J-ITSA", clientId: "client-1", date: new Date("2026-05-01") } },
      journal: { id: "j-itsa", reference: "J-ITSA", clientId: "client-1", date: new Date("2026-05-01") },
      invoice: null,
      vatReturn: null,
      itsaSubmission: {
        id: "q1",
        taxYear: "2025-26",
        periodId: "Q1",
        periodStart: new Date("2026-04-06"),
        periodEnd: new Date("2026-07-05"),
        status: "SUBMITTED",
        correlationId: "ITSA-Q1",
        incomes: { turnover: 5000 },
        expenses: { officeCosts: 250 },
        rawPayload: { adjustments: { privateUse: 40 } },
        clientId: "client-1",
      },
    });
    prisma.itsaEndOfPeriodStatement.findFirst.mockResolvedValue({
      id: "eops-1",
      taxYear: "2025-26",
      typeOfBusiness: "self-employment",
      accountingPeriodStart: new Date("2026-04-06"),
      accountingPeriodEnd: new Date("2027-04-05"),
      finalised: true,
      status: "SUBMITTED",
      correlationId: "EOPS-99",
      clientId: "client-1",
    });
    prisma.itsaFinalDeclaration.findFirst.mockResolvedValue({
      id: "final-1",
      taxYear: "2025-26",
      calculationId: "calc-1",
      finalised: true,
      status: "SUBMITTED",
      correlationId: "FD-1",
      rawPayload: { calculation: { incomeTax: 2100, nic: 400 } },
      clientId: "client-1",
    });

    const links = await service.build(user, "doc-itsa", "itsa");
    expect(links.chain).toBe("itsa");
    expect(links.path).toEqual(["document", "bankTransaction", "journalEntry", "quarterlyUpdate", "eops", "finalDeclaration"]);
    expect(links.quarterlyUpdate.detail).toMatchObject({
      hmrcSubmissionId: "ITSA-Q1",
      incomes: { turnover: 5000 },
      adjustments: { privateUse: 40 },
    });
    expect(links.eops.detail).toMatchObject({ hmrcSubmissionId: "EOPS-99", typeOfBusiness: "self-employment" });
    expect(links.finalDeclaration.detail).toMatchObject({ hmrcSubmissionId: "FD-1", calculation: { incomeTax: 2100, nic: 400 } });
  });

  it("throws when no resource belongs to the firm", async () => {
    await expect(service.build(user, "missing", "vat")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("exports digital links for a client period", async () => {
    prisma.vatReturn.findMany.mockResolvedValue([{ id: "vat-1" }]);
    prisma.salesInvoice.findMany.mockResolvedValue([{ id: "inv-1" }]);
    prisma.itsaUpdate.findMany.mockResolvedValue([]);
    prisma.vatReturn.findFirst.mockResolvedValue({ id: "vat-1", periodKey: "26A1", status: "SUBMITTED", clientId: "client-1" });
    prisma.salesInvoice.findFirst.mockResolvedValue({ id: "inv-1", invoiceNumber: "INV-1", clientId: "client-1" });

    const links = await service.forClientPeriod(user, "client-1", "2026-04");
    expect(authz.assertCanAccessClientData).toHaveBeenCalledWith(user, { firmId: "firm-a", clientId: "client-1" });
    expect(links).toHaveLength(2);
    expect(links[0].chain).toBe("vat");
    expect(links[1].chain).toBe("invoice");
  });
});
