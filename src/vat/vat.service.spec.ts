import { ObligationStatus } from "@prisma/client";
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

  const vatGateway = {
    getObligations: jest.fn(),
    submitReturn: jest.fn(),
    getPayments: jest.fn(),
    getReturn: jest.fn(),
  };
  const connections = { getCallContext: jest.fn().mockResolvedValue({ accessToken: "t", environment: "SANDBOX" }) };
  const clients = { get: jest.fn().mockResolvedValue(client) };
  const prisma = {
    vatObligation: { upsert: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    vatReturn: { create: jest.fn() },
  };
  const audit = { record: jest.fn() };
  const tasks = { ensure: jest.fn(), complete: jest.fn() };
  const notifications = { notify: jest.fn() };
  const webhooks = { emit: jest.fn() };

  const service = new VatService(
    vatGateway as never,
    connections as never,
    clients as never,
    prisma as never,
    audit as never,
    tasks as never,
    notifications as never,
    webhooks as never,
  );

  it("persists fetched obligations and opens a task", async () => {
    vatGateway.getObligations.mockResolvedValue({
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
    expect(tasks.ensure).toHaveBeenCalledWith("firm-1", "client-1", "MTD_VAT_RETURN", expect.any(Date), "VAT return 26A1");
    expect(result).toEqual([{ periodKey: "26A1" }]);
  });

  it("submits a finalised VAT return", async () => {
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
    vatGateway.submitReturn.mockResolvedValue({
      correlationId: "c2",
      status: 200,
      data: { processingDate: "2026-04-01T00:00:00Z", formBundleNumber: "FB1" },
    });
    prisma.vatObligation.findUnique.mockResolvedValue({ id: "ob1" });
    prisma.vatReturn.create.mockResolvedValue({ id: "ret1", formBundleNumber: "FB1" });
    prisma.vatObligation.update.mockResolvedValue({});

    const saved = await service.submit(user, client.id, dto);
    expect(saved.formBundleNumber).toBe("FB1");
    expect(webhooks.emit).toHaveBeenCalledWith("firm-1", "VAT_RETURN_SUBMITTED", expect.any(Object));
    expect(tasks.complete).toHaveBeenCalled();
  });
});
