import { Injectable } from "@nestjs/common";
import { EvidenceStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ClientsService,
  ) {}

  async list(user: AuthUser, clientId: string) {
    await this.clients.get(user, clientId);
    return this.prisma.supportingDocument.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(
    user: AuthUser,
    clientId: string,
    dto: { fileName: string; mimeType: string; sizeBytes: number; category?: string },
  ) {
    await this.clients.get(user, clientId);
    return this.prisma.supportingDocument.create({
      data: {
        clientId,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        category: dto.category,
        status: EvidenceStatus.PENDING,
        storageKey: `pending/${clientId}/${randomUUID()}/${dto.fileName}`,
        uploadedBy: user.id,
      },
    });
  }
}
