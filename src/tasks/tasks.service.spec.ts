import { NotFoundException } from "@nestjs/common";
import { TaskStatus, UserRole } from "@prisma/client";
import { TasksService } from "./tasks.service";

describe("TasksService", () => {
  const prisma = {
    task: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const service = new TasksService(prisma as never);
  const accountant = {
    id: "u1",
    firmId: "firm-1",
    role: UserRole.ACCOUNTANT,
    clientId: null,
  } as never;

  beforeEach(() => jest.clearAllMocks());

  it("scopes status updates to the caller's firm", async () => {
    prisma.task.updateMany.mockResolvedValue({ count: 1 });
    prisma.task.findFirst.mockResolvedValue({ id: "t1", status: TaskStatus.COMPLETED });
    await service.updateStatus(accountant, "t1", TaskStatus.COMPLETED);
    expect(prisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "t1", firmId: "firm-1" }),
      }),
    );
  });

  it("hides tasks that belong to another firm", async () => {
    prisma.task.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.updateStatus(accountant, "foreign", TaskStatus.COMPLETED)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
