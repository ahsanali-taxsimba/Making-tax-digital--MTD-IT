import { Injectable } from "@nestjs/common";
import { DocumentKind, ExtractionStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class InvoiceExtractionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findDocument(id: string) {
    return this.prisma.documentFile.findUnique({ where: { id } });
  }

  listForClient(clientId: string) {
    return this.prisma.documentFile.findMany({
      where: {
        clientId,
        OR: [
          { type: { in: [DocumentKind.INVOICE, DocumentKind.BILL, DocumentKind.RECEIPT] } },
          { extractionStatus: { not: ExtractionStatus.NOT_STARTED } },
          { extractedData: { not: Prisma.DbNull } },
        ],
      },
      orderBy: { uploadedAt: "desc" },
    });
  }

  listLogs(documentId: string) {
    return this.prisma.invoiceExtractionLog.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    });
  }

  listSupporting(clientId: string, documentId: string) {
    const tag = `extraction:${documentId}`;
    return this.prisma.documentFile.findMany({
      where: {
        clientId,
        id: { not: documentId },
        OR: [
          { tagLinks: { some: { tag: { name: tag } } } },
          { tags: { array_contains: tag } },
        ],
      },
      orderBy: { uploadedAt: "desc" },
    });
  }

  attachManyToInvoice(ids: string[], invoiceId: string) {
    if (!ids.length) {
      return Promise.resolve({ count: 0 });
    }
    return this.prisma.documentFile.updateMany({ where: { id: { in: ids } }, data: { invoiceId } });
  }

  attachManyToBill(ids: string[], billId: string) {
    if (!ids.length) {
      return Promise.resolve({ count: 0 });
    }
    return this.prisma.documentFile.updateMany({ where: { id: { in: ids } }, data: { billId } });
  }

  listAudit(query: { firmId: string; clientId: string; documentId?: string; invoiceId?: string; billId?: string }) {
    const metadataFilters = [
      query.documentId ? { metadata: { path: ["documentId"], equals: query.documentId } } : null,
      query.invoiceId ? { metadata: { path: ["invoiceId"], equals: query.invoiceId } } : null,
      query.billId ? { metadata: { path: ["billId"], equals: query.billId } } : null,
    ].filter(Boolean) as Prisma.AuditLogWhereInput[];
    return this.prisma.auditLog.findMany({
      where: {
        firmId: query.firmId,
        clientId: query.clientId,
        ...(metadataFilters.length ? { OR: metadataFilters } : { actionType: { startsWith: "invoice.extraction" } }),
      },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  markStatus(id: string, status: ExtractionStatus, extra?: Prisma.DocumentFileUpdateInput) {
    return this.prisma.documentFile.update({
      where: { id },
      data: { extractionStatus: status, ...extra },
    });
  }

  writeExtraction(
    id: string,
    data: {
      extractedData: Prisma.InputJsonValue;
      extractionConfidence: number;
      status: ExtractionStatus;
    },
  ) {
    return this.prisma.documentFile.update({
      where: { id },
      data: {
        extractedData: data.extractedData,
        extractionConfidence: data.extractionConfidence,
        extractionStatus: data.status,
      },
    });
  }

  log(data: Prisma.InvoiceExtractionLogCreateInput) {
    return this.prisma.invoiceExtractionLog.create({ data });
  }

  attachInvoice(documentId: string, invoiceId: string) {
    return this.prisma.documentFile.update({
      where: { id: documentId },
      data: { invoice: { connect: { id: invoiceId } } },
    });
  }

  attachBill(documentId: string, billId: string) {
    return this.prisma.documentFile.update({
      where: { id: documentId },
      data: { bill: { connect: { id: billId } } },
    });
  }
}
