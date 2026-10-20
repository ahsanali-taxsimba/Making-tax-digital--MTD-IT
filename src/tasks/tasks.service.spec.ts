import { BadRequestException, NotFoundException } from "@nestjs/common";
import { TaskStatus, TaskType, UserRole } from "@prisma/client";
import { TasksService } from "./tasks.service";

describe("TasksService", () => {
  const prisma = {
    task: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    client: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
  };
  const service = new TasksService(prisma as never);
  const actor = { id: "u1", role: UserRole.ADMIN, firmId: "f1", clientId: null, name: "Priya", email: "p" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a task for a firm client", async () => {
    prisma.client.findFirst.mockResolvedValue({ id: "c1", firmId: "f1" });
    prisma.user.findFirst.mockResolvedValue({ id: "a1" });
    prisma.task.create.mockResolvedValue({ id: "t1", title: "VAT return" });
    await expect(
      service.create(actor, {
        clientId: "c1",
        type: TaskType.VAT_RETURN,
        title: "VAT return",
        assigneeId: "a1",
      }),
    ).resolves.toEqual({ id: "t1", title: "VAT return" });
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ firmId: "f1", type: TaskType.VAT_RETURN, assigneeId: "a1" }),
      }),
    );
  });

  it("rejects an assignee outside the firm", async () => {
    prisma.client.findFirst.mockResolvedValue({ id: "c1", firmId: "f1" });
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.create(actor, { clientId: "c1", type: TaskType.BOOKKEEPING, title: "Books", assigneeId: "missing" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("updates status and assignee within the firm", async () => {
    prisma.task.findFirst.mockResolvedValue({ id: "t1", firmId: "f1" });
    prisma.user.findFirst.mockResolvedValue({ id: "a1" });
    prisma.task.update.mockResolvedValue({ id: "t1", status: TaskStatus.WAITING_ON_CLIENT });
    await expect(
      service.update(actor, "t1", { status: TaskStatus.WAITING_ON_CLIENT, assigneeId: "a1" }),
    ).resolves.toEqual({ id: "t1", status: TaskStatus.WAITING_ON_CLIENT });
  });

  it("does not update a task from another firm", async () => {
    prisma.task.findFirst.mockResolvedValue(null);
    await expect(service.update(actor, "t1", { status: TaskStatus.COMPLETED })).rejects.toBeInstanceOf(NotFoundException);
  });
});
