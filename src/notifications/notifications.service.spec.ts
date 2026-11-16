import { NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  const prisma = {
    notification: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const service = new NotificationsService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it("limits client users to their own or client-scoped notifications", async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    await service.list({
      id: "client-user",
      firmId: "firm-1",
      role: UserRole.CLIENT,
      clientId: "client-1",
    } as never);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ firmId: "firm-1" }),
      }),
    );
  });

  it("does not mark another firm's notification as read", async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.markRead(
        { id: "u1", firmId: "firm-1", role: UserRole.ACCOUNTANT, clientId: null } as never,
        "n1",
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
