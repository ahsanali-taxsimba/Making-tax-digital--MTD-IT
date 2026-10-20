import { ServiceUnavailableException } from "@nestjs/common";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("reports live without touching the database", () => {
    const prisma = { $queryRaw: jest.fn() };
    const controller = new HealthController(prisma as never);
    expect(controller.live()).toEqual({ status: "live", service: "mtd-it-api" });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("reports ready when the database answers", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) };
    const controller = new HealthController(prisma as never);
    await expect(controller.ready()).resolves.toEqual({ status: "ready", service: "mtd-it-api" });
  });

  it("fails readiness when the database is down", async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error("db down")) };
    const controller = new HealthController(prisma as never);
    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
