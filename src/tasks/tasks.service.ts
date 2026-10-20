import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { TaskStatus, TaskType, UserRole } from "@prisma/client";
import { AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTaskDto, UpdateTaskDto } from "./dto/task.dto";

const TASK_INCLUDE = {
  client: { select: { id: true, name: true, type: true } },
  assignee: { select: { id: true, name: true, role: true, status: true } },
} as const;

const OPEN_STATUSES: TaskStatus[] = [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.WAITING_ON_CLIENT];

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async ensure(firmId: string, clientId: string, type: TaskType, dueDate: Date | null, title: string) {
    const existing = await this.prisma.task.findFirst({
      where: { firmId, clientId, type, status: { in: OPEN_STATUSES } },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.task.create({ data: { firmId, clientId, type, dueDate, title } });
  }

  async complete(firmId: string, clientId: string, type: TaskType) {
    await this.prisma.task.updateMany({
      where: { firmId, clientId, type, status: { in: OPEN_STATUSES } },
      data: { status: TaskStatus.COMPLETED, completedAt: new Date() },
    });
  }

  list(user: AuthUser) {
    return this.prisma.task.findMany({
      where: { firmId: user.firmId, ...(user.clientId ? { clientId: user.clientId } : {}) },
      include: TASK_INCLUDE,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    });
  }

  async create(user: AuthUser, dto: CreateTaskDto) {
    await this.requireClient(user.firmId, dto.clientId);
    const assigneeId = dto.assigneeId ? await this.requireStaff(user.firmId, dto.assigneeId) : undefined;
    return this.prisma.task.create({
      data: {
        firmId: user.firmId,
        clientId: dto.clientId,
        type: dto.type,
        title: dto.title,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        assigneeId,
        status: dto.status ?? TaskStatus.OPEN,
      },
      include: TASK_INCLUDE,
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findFirst({ where: { id, firmId: user.firmId } });
    if (!task) {
      throw new NotFoundException("Task not found");
    }
    const assigneeId =
      dto.assigneeId === undefined ? undefined : dto.assigneeId === null ? null : await this.requireStaff(user.firmId, dto.assigneeId);
    return this.prisma.task.update({
      where: { id: task.id },
      data: {
        status: dto.status,
        title: dto.title,
        dueDate: dto.dueDate === undefined ? undefined : dto.dueDate === null ? null : new Date(dto.dueDate),
        assigneeId,
        completedAt: dto.status === TaskStatus.COMPLETED ? new Date() : dto.status ? null : undefined,
      },
      include: TASK_INCLUDE,
    });
  }

  updateStatus(user: AuthUser, id: string, status: TaskStatus) {
    return this.update(user, id, { status });
  }

  private async requireClient(firmId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, firmId } });
    if (!client) {
      throw new NotFoundException("Client not found");
    }
    return client;
  }

  private async requireStaff(firmId: string, userId: string) {
    const staff = await this.prisma.user.findFirst({
      where: { id: userId, firmId, role: { not: UserRole.CLIENT } },
    });
    if (!staff) {
      throw new BadRequestException("Assignee must be a staff member in this firm");
    }
    return staff.id;
  }
}
