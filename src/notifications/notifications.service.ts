import { Injectable, NotFoundException } from "@nestjs/common";
import { NotificationType, Prisma, UserRole } from "@prisma/client";
import { AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  notify(params: {
    firmId: string;
    userId?: string;
    type: NotificationType;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.notification.create({
      data: {
        firmId: params.firmId,
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  list(user: AuthUser) {
    return this.prisma.notification.findMany({
      where: this.scope(user),
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async markRead(user: AuthUser, id: string) {
    const updated = await this.prisma.notification.updateMany({
      where: { id, ...this.scope(user) },
      data: { readAt: new Date() },
    });
    if (updated.count === 0) {
      throw new NotFoundException("Notification not found");
    }
    return this.prisma.notification.findFirst({ where: { id, ...this.scope(user) } });
  }

  private scope(user: AuthUser): Prisma.NotificationWhereInput {
    if (user.role === UserRole.CLIENT) {
      return {
        firmId: user.firmId,
        OR: [
          { userId: user.id },
          { userId: null, ...(user.clientId ? { metadata: { path: ["clientId"], equals: user.clientId } } : {}) },
        ],
      };
    }
    return { firmId: user.firmId };
  }
}
