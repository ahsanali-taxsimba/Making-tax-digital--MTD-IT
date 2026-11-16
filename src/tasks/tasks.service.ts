import { Injectable, NotFoundException } from "@nestjs/common";
import { TaskStatus, TaskType, UserRole } from "@prisma/client";
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
      where: this.scope(user),
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    });
  }

  async updateStatus(user: AuthUser, id: string, status: TaskStatus) {
    const updated = await this.prisma.task.updateMany({
      where: { id, ...this.scope(user) },
      data: {
        status,
        completedAt: status === TaskStatus.COMPLETED ? new Date() : null,
      },
    });
    if (updated.count === 0) {
      throw new NotFoundException("Task not found");
    }
    return this.prisma.task.findFirst({ where: { id, ...this.scope(user) } });
  }

  private scope(user: AuthUser) {
    return {
      firmId: user.firmId,
      ...(user.role === UserRole.CLIENT && user.clientId ? { clientId: user.clientId } : {}),
    };
  }
}
