import { Injectable } from "@nestjs/common";
import { DocumentKind, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const include = {
  tagLinks: { include: { tag: true } },
} satisfies Prisma.DocumentFileInclude;

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.DocumentFileCreateInput) {
    return this.prisma.documentFile.create({ data, include });
  }

  find(id: string) {
    return this.prisma.documentFile.findUnique({ where: { id }, include });
  }

  list(clientId: string, filters?: { type?: DocumentKind; tag?: string }) {
    return this.prisma.documentFile.findMany({
      where: {
        clientId,
        ...(filters?.type ? { type: filters.type } : {}),
        ...(filters?.tag
          ? { tagLinks: { some: { tag: { name: { equals: filters.tag, mode: "insensitive" } } } } }
          : {}),
      },
      include,
      orderBy: { uploadedAt: "desc" },
    });
  }

  search(clientId: string, query: string, type?: DocumentKind) {
    return this.prisma.documentFile.findMany({
      where: {
        clientId,
        ...(type ? { type } : {}),
        OR: [
          { ocrText: { contains: query, mode: "insensitive" } },
          { fileName: { contains: query, mode: "insensitive" } },
          { ocrMerchant: { contains: query, mode: "insensitive" } },
          { ocrInvoiceNumber: { contains: query, mode: "insensitive" } },
          { tagLinks: { some: { tag: { name: { contains: query, mode: "insensitive" } } } } },
        ],
      },
      include,
      orderBy: { uploadedAt: "desc" },
      take: 100,
    });
  }

  update(id: string, data: Prisma.DocumentFileUpdateInput) {
    return this.prisma.documentFile.update({ where: { id }, data, include });
  }

  listTags() {
    return this.prisma.documentTag.findMany({ orderBy: { name: "asc" } });
  }

  async ensureTags(names: string[]) {
    const tags = [];
    for (const raw of names) {
      const name = raw.trim();
      if (!name) {
        continue;
      }
      const tag = await this.prisma.documentTag.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      tags.push(tag);
    }
    return tags;
  }

  setTagLinks(documentId: string, tagIds: string[]) {
    return this.prisma.$transaction([
      this.prisma.documentFileOnTag.deleteMany({ where: { documentId } }),
      ...tagIds.map((tagId) => this.prisma.documentFileOnTag.create({ data: { documentId, tagId } })),
    ]);
  }

  findBankTransaction(id: string) {
    return this.prisma.bankTransaction.findUnique({ where: { id }, include: { bankAccount: true } });
  }

  findInvoice(id: string) {
    return this.prisma.salesInvoice.findUnique({ where: { id } });
  }

  findBill(id: string) {
    return this.prisma.purchaseBill.findUnique({ where: { id } });
  }

  findJournal(id: string) {
    return this.prisma.journalEntry.findUnique({ where: { id } });
  }

  findVatReturn(id: string) {
    return this.prisma.vatReturn.findUnique({ where: { id } });
  }

  findItsaSubmission(id: string) {
    return this.prisma.itsaUpdate.findUnique({ where: { id } });
  }
}
