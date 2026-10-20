import { UserRole } from "@prisma/client";
import { AuthorizationService } from "../authorization/authorization.service";
import { AdminService } from "./admin.service";

describe("AdminService visibility", () => {
  const prisma = {
    firm: { findMany: jest.fn(), findUnique: jest.fn() },
    client: { count: jest.fn(), findMany: jest.fn() },
    user: { count: jest.fn(), findMany: jest.fn() },
    vatReturn: { count: jest.fn() },
    itsaUpdate: { count: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const service = new AdminService(prisma as never, new AuthorizationService());
  const owner = {
    id: "p1",
    email: "o",
    name: "Owen",
    role: UserRole.ADMIN,
    firmId: "",
    clientId: null,
    principal: "platform" as const,
    platformRole: "admin_owner" as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.firm.findMany.mockResolvedValue([{ id: "f1", name: "Northbridge", slug: "northbridge", subscriptionPlan: "practice", planType: "PRACTICE", createdAt: new Date() }]);
    prisma.firm.findUnique.mockResolvedValue({ id: "f1", name: "Northbridge", slug: "northbridge", subscriptionPlan: "practice", planType: "PRACTICE" });
    prisma.client.count.mockResolvedValue(3);
    prisma.user.count.mockResolvedValue(4);
    prisma.vatReturn.count.mockResolvedValue(2);
    prisma.itsaUpdate.count.mockResolvedValue(1);
  });

  it("returns aggregated counts without client records", async () => {
    const rows = await service.listFirms(owner);
    expect(rows[0]).toMatchObject({
      id: "f1",
      totalClients: 3,
      totalFirmUsers: 4,
      totalVatReturns: 2,
      totalItsaSubmissions: 1,
    });
    expect(rows[0]).not.toHaveProperty("clients");
    expect(rows[0]).not.toHaveProperty("documents");
    expect(prisma.client.findMany).not.toHaveBeenCalled();
  });

  it("refuses marketing from detailed stats and support-only metadata for owners", async () => {
    const marketing = { ...owner, platformRole: "admin_marketing" as const };
    await expect(service.firmStats(marketing, "f1")).resolves.toBeDefined();
    await expect(service.firmMetadata(owner, "f1")).rejects.toMatchObject({ errorCode: "AUTHZ_ERR_DENIED" });
  });
});
