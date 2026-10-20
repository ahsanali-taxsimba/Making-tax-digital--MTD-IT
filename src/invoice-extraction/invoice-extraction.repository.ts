import { Injectable } from "@nestjs/common";
import { ExtractionStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class InvoiceExtractionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findDocument(id: string) {
    return this.prisma.documentFile.findUnique({ where: { id } });
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
