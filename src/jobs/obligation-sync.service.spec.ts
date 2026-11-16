import { ObligationSyncService } from "./obligation-sync.service";

describe("ObligationSyncService", () => {
  it("syncs VAT and ITSA for connected clients without sending notifications", async () => {
    const prisma = {
      mtdConnection: {
        findMany: jest.fn().mockResolvedValue([
          {
            clientId: "c1",
            client: {
              id: "c1",
              firmId: "firm-1",
              vatRegistrationNumber: "888888888",
              nino: "AA123456A",
              niNumber: "AA123456A",
            },
          },
        ]),
      },
    };
    const vat = { obligations: jest.fn().mockResolvedValue([]) };
    const itsa = { obligations: jest.fn().mockResolvedValue([]) };
    const service = new ObligationSyncService(prisma as never, vat as never, itsa as never, {
      get: () => "test",
    } as never);

    const result = await service.tick();
    expect(result).toEqual({ vat: 1, itsa: 1, failed: 0 });
    expect(vat.obligations).toHaveBeenCalledWith(expect.objectContaining({ firmId: "firm-1" }), "c1", {
      notify: false,
    });
    expect(itsa.obligations).toHaveBeenCalledWith(expect.objectContaining({ firmId: "firm-1" }), "c1", {
      notify: false,
    });
  });
});
