import { ObligationStatus } from "@prisma/client";
import { VatRepository } from "./vat.repository";
import { VatService } from "./vat.service";
import { SubmitVatReturnDto } from "./dto/vat.dto";

describe("VatService", () => {
  const client = {
    id: "client-1",
    firmId: "firm-1",
    name: "Amelia Hartley",
    vatRegistrationNumber: "888888888",
  };
  const user = { id: "u1", firmId: "firm-1" } as never;

  const hmrc = { get: jest.fn(), post: jest.fn() };
  const clients = { get: jest.fn().mockResolvedValue(client) };
  const prisma = {
    vatObligation: { upsert: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    vatReturn: { create: jest.fn() },
    vatPayment: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
    ledger: { findMany: jest.fn() },
    transaction: { count: jest.fn().mockResolvedValue(4) },
    vatTransactionSummary: { upsert: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
  };
  const repo = new VatRepository(prisma as never);
  const audit = { record: jest.fn() };
  const tasks = { ensure: jest.fn(), complete: jest.fn() };
  const notifications = { notify: jest.fn() };
  const webhooks = { emit: jest.fn() };

  const service = new VatService(
    hmrc as never,
    clients as never,
    prisma as never,
    audit as never,
    tasks as never,
    notifications as never,
    webhooks as never,
    repo,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    clients.get.mockResolvedValue(client);
  });

  it("returns the nine-box catalog", () => {
    const catalog = service.mapping();
    expect(catalog.boxes.box_1.name).toContain("VAT due on sales");
    expect(catalog.fields.box_5).toBe("netVatDue");
  });

  it("persists fetched obligations through HmrcClientService.get", async () => {
    hmrc.get.mockResolvedValue({
      correlationId: "c1",
      status: 200,
      data: {
        obligations: [{ periodKey: "26A1", start: "2026-01-01", end: "2026-03-31", due: "2026-05-07", status: "O" }],
      },
    });
    prisma.vatObligation.upsert.mockResolvedValue({
      periodKey: "26A1",
      status: ObligationStatus.OPEN,
      due: new Date("2026-05-07"),
    });
    prisma.vatObligation.findMany.mockResolvedValue([{ periodKey: "26A1" }]);

    const result = await service.obligations(user, client.id);
    expect(hmrc.get).toHaveBeenCalledWith("/organisations/vat/888888888/obligations", "client-1");
    expect(tasks.ensure).toHaveBeenCalledWith("firm-1", "client-1", "MTD_VAT_RETURN", expect.any(Date), "VAT return 26A1");
    expect(result).toEqual([{ periodKey: "26A1" }]);
  });

  it("previews boxes 1-9 from ledger lines", async () => {
    prisma.ledger.findMany.mockResolvedValue([
      {
        code: 1000,
        name: "Sales - Services",
        profile: "SOLE_TRADER",
        transactions: [{ amount: 6000 }],
      },
      {
        code: 2200,
        name: "VAT on Sales",
        profile: "SOLE_TRADER",
        transactions: [{ amount: 1200 }],
      },
      {
        code: 3000,
        name: "Advertising",
        profile: "SOLE_TRADER",
        transactions: [{ amount: 1000 }],
      },
      {
        code: 2220,
        name: "VAT on Purchases",
        profile: "SOLE_TRADER",
        transactions: [{ amount: 200 }],
      },
      {
        code: 4000,
        name: "Office Equipment",
        profile: "SOLE_TRADER",
        transactions: [{ amount: 1500 }],
      },
    ]);

    const preview = await service.previewReturn(user, client.id, {
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
      periodKey: "26A1",
    });

    expect(preview.totals).toEqual({
      vatDueSales: 1200,
      vatDueAcquisitions: 0,
      totalVatDue: 1200,
      vatReclaimedCurrPeriod: 200,
      netVatDue: 1000,
      totalValueSalesExVAT: 6000,
      totalValuePurchasesExVAT: 1000,
      totalValueGoodsSuppliedExVAT: 0,
      totalAcquisitionsExVAT: 0,
    });
    expect(preview.excluded).toEqual([
      expect.objectContaining({ code: 4000, reason: "unmapped" }),
    ]);
    expect(preview.boxes.find((box) => box.id === "box_5")?.value).toBe(1000);
    expect(preview.validation).toEqual({ valid: true, errors: [], warnings: [], issues: [] });
    expect(preview.vatReturn.box5).toBe(1000);
  });

  it("submits a finalised VAT return through HmrcClientService.post", async () => {
    const dto: SubmitVatReturnDto = {
      periodKey: "26A1",
      vatDueSales: 1200,
      vatDueAcquisitions: 0,
      totalVatDue: 1200,
      vatReclaimedCurrPeriod: 200,
      netVatDue: 1000,
      totalValueSalesExVAT: 6000,
      totalValuePurchasesExVAT: 1000,
      totalValueGoodsSuppliedExVAT: 0,
      totalAcquisitionsExVAT: 0,
      finalised: true,
    };
    hmrc.post.mockResolvedValue({
      correlationId: "c2",
      status: 200,
      data: { processingDate: "2026-04-01T00:00:00Z", formBundleNumber: "FB1" },
    });
    prisma.vatObligation.findUnique.mockResolvedValue({
      id: "ob1",
      periodKey: "26A1",
      start: new Date("2026-01-01T00:00:00.000Z"),
      end: new Date("2026-03-31T00:00:00.000Z"),
    });
    prisma.vatReturn.create.mockResolvedValue({ id: "ret1", formBundleNumber: "FB1" });
    prisma.vatObligation.update.mockResolvedValue({});

    const saved = await service.submit(user, client.id, dto);
    expect(hmrc.post).toHaveBeenCalledWith(
      "/organisations/vat/888888888/returns",
      expect.objectContaining({
        periodKey: "26A1",
        vatDueSales: 1200,
        netVatDue: 1000,
        finalised: true,
      }),
      "client-1",
    );
    expect(prisma.vatReturn.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ obligationId: "ob1" }),
      }),
    );
    expect(saved.formBundleNumber).toBe("FB1");
    expect(webhooks.emit).toHaveBeenCalledWith("firm-1", "VAT_RETURN_SUBMITTED", expect.any(Object));
    expect(tasks.complete).toHaveBeenCalled();
  });

  it("submits from ledger using the obligation dates when period bounds are omitted", async () => {
    prisma.vatObligation.findUnique.mockResolvedValue({
      id: "ob1",
      periodKey: "26A1",
      start: new Date("2026-01-01T00:00:00.000Z"),
      end: new Date("2026-03-31T00:00:00.000Z"),
    });
    prisma.ledger.findMany.mockResolvedValue([
      { code: 1000, name: "Sales", profile: "SOLE_TRADER", transactions: [{ amount: 6000 }] },
      { code: 2200, name: "VAT on Sales", profile: "SOLE_TRADER", transactions: [{ amount: 1200 }] },
      { code: 2220, name: "VAT on Purchases", profile: "SOLE_TRADER", transactions: [{ amount: 200 }] },
      { code: 3000, name: "Advertising", profile: "SOLE_TRADER", transactions: [{ amount: 1000 }] },
    ]);
    hmrc.post.mockResolvedValue({
      correlationId: "c3",
      status: 200,
      data: { processingDate: "2026-04-01T00:00:00Z", formBundleNumber: "FB2" },
    });
    prisma.vatReturn.create.mockResolvedValue({ id: "ret2", formBundleNumber: "FB2" });
    prisma.vatObligation.update.mockResolvedValue({});

    await service.submit(user, client.id, { periodKey: "26A1", fromLedger: true, finalised: true });

    expect(hmrc.post).toHaveBeenCalledWith(
      "/organisations/vat/888888888/returns",
      expect.objectContaining({
        periodKey: "26A1",
        vatDueSales: 1200,
        totalVatDue: 1200,
        vatReclaimedCurrPeriod: 200,
        netVatDue: 1000,
        totalValueSalesExVAT: 6000,
        finalised: true,
      }),
      "client-1",
    );
  });

  it("rejects fromLedger submit when no period dates or obligation exist", async () => {
    prisma.vatObligation.findUnique.mockResolvedValue(null);
    await expect(service.submit(user, client.id, { periodKey: "26A9", fromLedger: true, finalised: true })).rejects.toThrow(
      "periodStart and periodEnd are required when fromLedger is true",
    );
  });

  it("blocks submit when box arithmetic is wrong", async () => {
    prisma.vatObligation.findUnique.mockResolvedValue(null);
    await expect(
      service.submit(user, client.id, {
        periodKey: "26A1",
        vatDueSales: 1200,
        vatDueAcquisitions: 0,
        totalVatDue: 900,
        vatReclaimedCurrPeriod: 200,
        netVatDue: 700,
        totalValueSalesExVAT: 6000,
        totalValuePurchasesExVAT: 1000,
        totalValueGoodsSuppliedExVAT: 0,
        totalAcquisitionsExVAT: 0,
        finalised: true,
      }),
    ).rejects.toThrow("VAT return failed validation");
    expect(hmrc.post).not.toHaveBeenCalled();
  });

  it("validates a fromLedger return without submitting", async () => {
    prisma.ledger.findMany.mockResolvedValue([
      { code: 4000, name: "Equipment", profile: "SOLE_TRADER", transactions: [{ amount: 1500 }] },
    ]);
    const result = await service.validateReturn(user, client.id, {
      fromLedger: true,
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
    });
    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors).toContain("Return is zero but ledger shows transactions – check mapping.");
  });

  it("syncs VAT payments through HmrcClientService.get", async () => {
    hmrc.get.mockResolvedValue({
      correlationId: "pay-1",
      status: 200,
      data: { payments: [{ amount: 1000, received: "2026-02-10" }] },
    });
    prisma.vatPayment.findMany.mockResolvedValue([{ amount: 1000 }]);
    const rows = await service.payments(user, client.id);
    expect(hmrc.get).toHaveBeenCalledWith("/organisations/vat/888888888/payments", "client-1");
    expect(prisma.vatPayment.createMany).toHaveBeenCalled();
    expect(rows).toEqual([{ amount: 1000 }]);
  });
});
