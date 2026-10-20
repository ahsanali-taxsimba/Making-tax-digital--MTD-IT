import { NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  const prisma = {
    notification: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const service = new NotificationsService(prisma as never);
  const user = {
    id: "u1",
    email: "james@northbridge.test",
    name: "James",
    role: UserRole.ACCOUNTANT,
    firmId: "firm-a",
    clientId: null,
    principal: "firm" as const,
    firmRole: "firm_accountant" as const,
  };

  beforeEach(() => jest.clearAllMocks());

  it("lists only firm-wide and own notifications", async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    await service.list(user);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { firmId: "firm-a", OR: [{ userId: null }, { userId: "u1" }] },
      }),
    );
  });

  it("refuses to mark another tenant's notification read", async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.markRead(user, "note-other-firm")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "note-other-firm", firmId: "firm-a" }),
      }),
    );
  });
});
