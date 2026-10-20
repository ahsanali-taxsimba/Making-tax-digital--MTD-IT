import { Injectable } from "@nestjs/common";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ClientsService,
  ) {}

  async list(user: AuthUser, clientId: string) {
    await this.clients.get(user, clientId);
    return this.prisma.clientMessage.findMany({
      where: { clientId },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(user: AuthUser, clientId: string, body: string) {
    await this.clients.get(user, clientId);
    return this.prisma.clientMessage.create({
      data: {
        clientId,
        authorId: user.id,
        authorRole: user.role,
        authorName: user.name,
        body,
      },
    });
  }
}
