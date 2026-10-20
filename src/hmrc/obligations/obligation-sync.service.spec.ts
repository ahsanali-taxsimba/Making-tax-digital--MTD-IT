import { ObligationStatus } from "@prisma/client";
import { ObligationSyncService } from "./obligation-sync.service";

describe("ObligationSyncService", () => {
  const vat = { obligations: jest.fn().mockResolvedValue([]) };
  const itsa = { obligations: jest.fn().mockResolvedValue([]) };
  const notifications = { notify: jest.fn() };
  const config = {
    get: jest.fn((key: string) => {
      if (key === "nodeEnv") return "test";
      if (key === "hmrc.obligationDueDays") return 14;
      return undefined;
    }),
  };
  const prisma = {
    mtdConnection: { findMany: jest.fn() },
    vatObligation: { findMany: jest.fn(), update: jest.fn() },
    itsaObligation: { findMany: jest.fn(), update: jest.fn() },
  };
  const service = new ObligationSyncService(
    prisma as never,
    vat as never,
    itsa as never,
    notifications as never,
    config as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.vatObligation.update.mockResolvedValue({});
    prisma.itsaObligation.update.mockResolvedValue({});
  });

  it("syncs connected VAT and ITSA clients without broadcasting fetch notices", async () => {
    prisma.mtdConnection.findMany.mockResolvedValue([
      {
        clientId: "client-1",
        client: {
          id: "client-1",
          firmId: "firm-1",
          vatRegistrationNumber: "888888888",
          nino: "AA123456A",
          niNumber: "AA123456A",
        },
      },
      {
        clientId: "client-1",
        client: {
          id: "client-1",
          firmId: "firm-1",
          vatRegistrationNumber: "888888888",
          nino: "AA123456A",
          niNumber: "AA123456A",
        },
      },
    ]);
    const count = await service.syncConnectedClients();
    expect(count).toBe(1);
    expect(vat.obligations).toHaveBeenCalledTimes(1);
    expect(vat.obligations).toHaveBeenCalledWith(
      expect.objectContaining({ id: "system:obligation-sync", firmId: "firm-1" }),
      "client-1",
      { notifyFetched: false },
    );
    expect(itsa.obligations).toHaveBeenCalledWith(
      expect.objectContaining({ firmRole: "firm_admin" }),
      "client-1",
      { notifyFetched: false },
    );
  });

  it("notifies once for open obligations inside the due window", async () => {
    prisma.vatObligation.findMany.mockResolvedValue([
      {
        id: "vat-ob-1",
        periodKey: "26A1",
        due: new Date("2026-05-07T00:00:00.000Z"),
        clientId: "client-1",
        client: { firmId: "firm-1", name: "Amelia Hartley" },
      },
    ]);
    prisma.itsaObligation.findMany.mockResolvedValue([
      {
        id: "itsa-ob-1",
        type: "QUARTERLY_UPDATE",
        taxYear: "2025-26",
        due: new Date("2026-08-07T00:00:00.000Z"),
        clientId: "client-1",
        client: { firmId: "firm-1", name: "Amelia Hartley" },
      },
    ]);
    const sent = await service.notifyDue();
    expect(sent).toBe(2);
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "OBLIGATION_DUE", firmId: "firm-1" }),
    );
    expect(prisma.vatObligation.update).toHaveBeenCalledWith({
      where: { id: "vat-ob-1" },
      data: { dueNotifiedAt: expect.any(Date) },
    });
    expect(prisma.itsaObligation.update).toHaveBeenCalledWith({
      where: { id: "itsa-ob-1" },
      data: { dueNotifiedAt: expect.any(Date) },
    });
    expect(prisma.vatObligation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: ObligationStatus.OPEN, dueNotifiedAt: null }),
      }),
    );
  });
});
