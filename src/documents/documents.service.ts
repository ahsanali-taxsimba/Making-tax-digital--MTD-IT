import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";
import { STORAGE_PORT, StoragePort } from "../storage/storage.types";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ClientsService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly config: ConfigService,
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
    dto: { fileName: string; mimeType: string; sizeBytes: number },
  ) {
    await this.clients.get(user, clientId);
    return this.prisma.supportingDocument.create({
      data: {
        clientId,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        storageKey: `pending/${clientId}/${randomUUID()}/${dto.fileName}`,
        uploadedBy: user.id,
      },
    });
  }

  async upload(
    user: AuthUser,
    clientId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    await this.clients.get(user, clientId);
    this.assertFile(file);
    const key = `${clientId}/${randomUUID()}/${safeName(file.originalname)}`;
    const stored = await this.storage.put(key, file.buffer, file.mimetype);
    return this.prisma.supportingDocument.create({
      data: {
        clientId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: stored.sizeBytes,
        storageKey: stored.key,
        uploadedBy: user.id,
      },
    });
  }

  async download(user: AuthUser, clientId: string, documentId: string) {
    await this.clients.get(user, clientId);
    const doc = await this.prisma.supportingDocument.findFirst({
      where: { id: documentId, clientId },
    });
    if (!doc) {
      throw new NotFoundException("Document not found");
    }
    if (doc.storageKey.startsWith("pending/")) {
      throw new NotFoundException("Document bytes have not been uploaded yet");
    }
    const stored = await this.storage.get(doc.storageKey);
    return { ...doc, body: stored.body, mimeType: stored.mimeType || doc.mimeType };
  }

  private assertFile(file: { mimetype: string; size: number; buffer: Buffer }) {
    const max = this.config.get<number>("storage.maxUploadBytes") ?? 10 * 1024 * 1024;
    if (!file?.buffer?.length) {
      throw new BadRequestException("A file is required");
    }
    if (file.size > max) {
      throw new BadRequestException(`File exceeds the ${max} byte upload limit`);
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(`MIME type ${file.mimetype} is not allowed`);
    }
  }
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180) || "document";
}
