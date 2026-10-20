import { ChartProfile } from "@prisma/client";
import { ItsaService } from "./itsa.service";

describe("ItsaService", () => {
  const client = {
    id: "client-1",
    firmId: "firm-1",
    name: "Amelia Hartley",
    nino: "AA123456A",
    niNumber: "AA123456A",
  };
  const business = { id: "biz-1", clientId: client.id, type: "self-employment", hmrcBusinessId: "XAIS1", tradingName: "Studio" };
  const user = { id: "u1", firmId: "firm-1" } as never;

  const hmrc = { get: jest.fn(), post: jest.fn(), put: jest.fn() };
  const clients = { get: jest.fn().mockResolvedValue(client) };
  const repo = {
    findBusiness: jest.fn().mockResolvedValue(business),
    findBusinessByHmrcId: jest.fn().mockResolvedValue(business),
    listBusinesses: jest.fn().mockResolvedValue([business]),
    listUpdates: jest.fn().mockResolvedValue([{ id: "u1" }]),
    listEops: jest.fn().mockResolvedValue([{ businessId: business.id }]),
    listFinals: jest.fn().mockResolvedValue([]),
    findObligation: jest.fn().mockResolvedValue({
      periodId: "2026-04-06_2026-07-05",
      start: new Date("2026-04-06T00:00:00.000Z"),
      end: new Date("2026-07-05T00:00:00.000Z"),
    }),
    listObligations: jest.fn().mockResolvedValue([{ type: "QUARTERLY_UPDATE" }]),
    upsertObligation: jest.fn(),
    updateObligation: jest.fn(),
    loadLedgersForPeriod: jest.fn().mockResolvedValue([
      {
        code: 1000,
        name: "Sales",
        profile: ChartProfile.SOLE_TRADER,
        transactions: [{ amount: 5000 }],
      },
    ]),
    countTransactions: jest.fn().mockResolvedValue(1),
    createUpdate: jest.fn().mockResolvedValue({ id: "upd-1" }),
    createEops: jest.fn().mockResolvedValue({ id: "eops-1" }),
    createFinal: jest.fn().mockResolvedValue({ id: "fd-1" }),
  };
  const audit = { record: jest.fn() };
  const tasks = { complete: jest.fn(), ensure: jest.fn() };
  const notifications = { notify: jest.fn() };
  const webhooks = { emit: jest.fn() };

  const service = new ItsaService(
    hmrc as never,
    clients as never,
    repo as never,
    audit as never,
    tasks as never,
    notifications as never,
    webhooks as never,
    { evidenceForClient: jest.fn().mockResolvedValue({ receiptsAttached: 2, itsa: { attached: 2, allowableExpenses: 3, allowableExpensesWithReceipt: 2 } }) } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    clients.get.mockResolvedValue(client);
    repo.findBusiness.mockResolvedValue(business);
    repo.findObligation.mockResolvedValue({
      periodId: "2026-04-06_2026-07-05",
      start: new Date("2026-04-06T00:00:00.000Z"),
      end: new Date("2026-07-05T00:00:00.000Z"),
    });
    hmrc.post.mockResolvedValue({ correlationId: "c1", data: { periodId: "p1" } });
    hmrc.put.mockResolvedValue({ correlationId: "c1", data: { periodId: "p1" } });
    repo.createUpdate.mockResolvedValue({ id: "upd-1" });
  });

  it("fetches ITSA obligations through HmrcClientService.get", async () => {
    hmrc.get.mockResolvedValue({
      correlationId: "ob-1",
      data: {
        obligations: [
          {
            type: "QUARTERLY_UPDATE",
            taxYear: "2025-26",
            periodId: "2026-04-06_2026-07-05",
            start: "2026-04-06",
            end: "2026-07-05",
            due: "2026-08-07",
            status: "Open",
            businessId: "XAIS1",
          },
        ],
      },
    });
    repo.findObligation.mockResolvedValueOnce(null);
    const rows = await service.obligations(user, client.id);
    expect(hmrc.get).toHaveBeenCalledWith("/income-tax/AA123456A/obligations", "client-1");
    expect(repo.upsertObligation).toHaveBeenCalled();
    expect(tasks.ensure).toHaveBeenCalledWith("firm-1", "client-1", "MTD_ITSA_UPDATE", expect.any(Date), expect.any(String));
    expect(rows).toEqual([{ type: "QUARTERLY_UPDATE" }]);
  });

  it("submits a fromLedger quarterly update after validation", async () => {
    const saved = await service.submitUpdate(user, client.id, {
      businessId: business.id,
      taxYear: "2025-26",
      periodId: "2026-04-06_2026-07-05",
      periodStart: "2026-04-06",
      periodEnd: "2026-07-05",
      fromLedger: true,
    });
    expect(saved.id).toBe("upd-1");
    expect(hmrc.put).toHaveBeenCalledWith(
      "/income-tax/AA123456A/updates",
      expect.objectContaining({ incomes: { turnover: 5000 }, businessId: "XAIS1" }),
      "client-1",
    );
  });

  it("blocks a quarterly update that includes a capital category", async () => {
    await expect(
      service.submitUpdate(user, client.id, {
        businessId: business.id,
        taxYear: "2025-26",
        periodId: "2026-04-06_2026-07-05",
        periodStart: "2026-04-06",
        periodEnd: "2026-07-05",
        incomes: { turnover: 100 },
        expenses: { capitalExpenditureNotInQuarterlyUpdate: 50 },
      }),
    ).rejects.toThrow("ITSA submission failed validation");
    expect(hmrc.post).not.toHaveBeenCalled();
    expect(hmrc.put).not.toHaveBeenCalled();
  });

  it("submits EOPS through HmrcClientService.put after completeness checks", async () => {
    hmrc.put.mockResolvedValue({ correlationId: "e1", data: { processingDate: "2026-04-01T00:00:00Z" } });
    const saved = await service.submitEops(user, client.id, {
      businessId: business.id,
      taxYear: "2025-26",
      typeOfBusiness: "self-employment",
      accountingPeriodStart: "2026-04-06",
      accountingPeriodEnd: "2027-04-05",
      finalised: true,
    });
    expect(saved.id).toBe("eops-1");
    expect(hmrc.put).toHaveBeenCalledWith(
      "/income-tax/AA123456A/eops",
      expect.objectContaining({ businessId: "XAIS1", finalised: true }),
      "client-1",
    );
  });

  it("submits a UK property quarterly update with PUT", async () => {
    repo.findBusiness.mockResolvedValue({ ...business, type: "uk-property" });
    hmrc.put.mockResolvedValue({ correlationId: "p1", data: { periodId: "q1" } });
    await service.submitUpdate(user, client.id, {
      businessId: business.id,
      taxYear: "2025-26",
      periodId: "2026-04-06_2026-07-05",
      periodStart: "2026-04-06",
      periodEnd: "2026-07-05",
      incomes: { ukPropertyIncome: 5000 },
      expenses: { propertyRepairsAndMaintenance: 10 },
    });
    expect(hmrc.put).toHaveBeenCalledWith(
      "/income-tax/AA123456A/uk-property/periodic",
      expect.objectContaining({ typeOfBusiness: "uk-property", businessId: "XAIS1" }),
      "client-1",
    );
  });

  it("submits a final declaration through HmrcClientService.post", async () => {
    hmrc.post.mockResolvedValue({ correlationId: "f1", data: { calculationId: "calc-9" } });
    const saved = await service.submitFinal(user, client.id, { taxYear: "2025-26", finalised: true });
    expect(saved.id).toBe("fd-1");
    expect(hmrc.post).toHaveBeenCalledWith(
      "/income-tax/AA123456A/calculations/final-declaration",
      expect.objectContaining({ taxYear: "2025-26", finalised: true }),
      "client-1",
    );
  });
});
