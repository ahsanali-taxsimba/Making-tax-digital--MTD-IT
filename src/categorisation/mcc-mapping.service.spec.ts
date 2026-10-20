import { MCCMappingService } from "./mcc-mapping.service";

describe("MCCMappingService", () => {
  const repo = { listMccRules: jest.fn().mockResolvedValue([]) };
  const service = new MCCMappingService(repo as never);

  it("looks up restaurants by MCC 5812", async () => {
    const hit = await service.lookup("5812");
    expect(hit?.industry).toBe("Restaurants");
    expect(service.isVatable("5812")).toBe(true);
  });

  it("treats insurance MCC 6300 as exempt", async () => {
    expect(service.isExempt("6300")).toBe(true);
    expect((await service.lookup("6300"))?.vatable).toBe(false);
  });
});
