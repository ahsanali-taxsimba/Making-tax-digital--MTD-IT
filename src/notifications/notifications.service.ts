import { Injectable } from "@nestjs/common";
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
      where: { firmId: user.firmId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  markRead(user: AuthUser, id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }
}
