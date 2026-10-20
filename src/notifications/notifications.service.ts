import { Injectable, NotFoundException } from "@nestjs/common";
import { NotificationType, Prisma } from "@prisma/client";
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
      where: {
        firmId: user.firmId,
        OR: [{ userId: null }, { userId: user.id }],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async markRead(user: AuthUser, id: string) {
    const updated = await this.prisma.notification.updateMany({
      where: {
        id,
        firmId: user.firmId,
        OR: [{ userId: null }, { userId: user.id }],
      },
      data: { readAt: new Date() },
    });
    if (!updated.count) {
      throw new NotFoundException("Notification not found");
    }
    return { id, read: true };
  }
}
