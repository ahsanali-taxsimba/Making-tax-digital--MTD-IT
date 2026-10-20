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

  const gateway = { getObligations: jest.fn(), submitQuarterlyUpdate: jest.fn(), submitEops: jest.fn(), submitFinalDeclaration: jest.fn() };
  const connections = { getCallContext: jest.fn().mockResolvedValue({ accessToken: "t" }) };
  const clients = { get: jest.fn().mockResolvedValue(client) };
  const repo = {
    findBusiness: jest.fn().mockResolvedValue(business),
    listBusinesses: jest.fn().mockResolvedValue([business]),
    listUpdates: jest.fn().mockResolvedValue([{ id: "u1" }]),
    listEops: jest.fn().mockResolvedValue([{ businessId: business.id }]),
    listFinals: jest.fn().mockResolvedValue([]),
    findObligation: jest.fn().mockResolvedValue({
      periodId: "2026-04-06_2026-07-05",
      start: new Date("2026-04-06T00:00:00.000Z"),
      end: new Date("2026-07-05T00:00:00.000Z"),
    }),
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
  const tasks = { complete: jest.fn() };
  const notifications = { notify: jest.fn() };
  const webhooks = { emit: jest.fn() };

  const service = new ItsaService(
    gateway as never,
    connections as never,
    clients as never,
    repo as never,
    audit as never,
    tasks as never,
    notifications as never,
    webhooks as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    clients.get.mockResolvedValue(client);
    repo.findBusiness.mockResolvedValue(business);
    gateway.submitQuarterlyUpdate.mockResolvedValue({ correlationId: "c1", data: { periodId: "p1" } });
    repo.createUpdate.mockResolvedValue({ id: "upd-1" });
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
    expect(gateway.submitQuarterlyUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      "AA123456A",
      expect.objectContaining({ incomes: { turnover: 5000 } }),
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
    expect(gateway.submitQuarterlyUpdate).not.toHaveBeenCalled();
  });
});
