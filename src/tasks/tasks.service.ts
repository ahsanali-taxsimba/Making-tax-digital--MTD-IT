import { Injectable } from "@nestjs/common";
import { TaskStatus, TaskType } from "@prisma/client";
import { AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async ensure(firmId: string, clientId: string, type: TaskType, dueDate: Date | null, title: string) {
    const existing = await this.prisma.task.findFirst({
      where: { firmId, clientId, type, status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] } },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.task.create({ data: { firmId, clientId, type, dueDate, title } });
  }

  async complete(firmId: string, clientId: string, type: TaskType) {
    await this.prisma.task.updateMany({
      where: { firmId, clientId, type, status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] } },
      data: { status: TaskStatus.COMPLETED, completedAt: new Date() },
    });
  }

  list(user: AuthUser) {
    return this.prisma.task.findMany({
      where: { firmId: user.firmId, ...(user.clientId ? { clientId: user.clientId } : {}) },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    });
  }

  updateStatus(user: AuthUser, id: string, status: TaskStatus) {
    return this.prisma.task.update({
      where: { id },
      data: {
        status,
        completedAt: status === TaskStatus.COMPLETED ? new Date() : null,
      },
    });
  }
}
