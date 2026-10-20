import { Injectable } from "@nestjs/common";
import { Prisma, ReceiptStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const include = {
  tagLinks: { include: { tag: true } },
} satisfies Prisma.ReceiptFileInclude;

@Injectable()
export class ReceiptsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ReceiptFileCreateInput) {
    return this.prisma.receiptFile.create({ data, include });
  }

  find(id: string) {
    return this.prisma.receiptFile.findUnique({ where: { id }, include });
  }

  list(clientId: string) {
    return this.prisma.receiptFile.findMany({
      where: { clientId },
      include,
      orderBy: { uploadedAt: "desc" },
    });
  }

  listForBankTransaction(id: string) {
    return this.prisma.receiptFile.findMany({ where: { bankTransactionId: id }, include, orderBy: { uploadedAt: "desc" } });
  }

  listForInvoice(id: string) {
    return this.prisma.receiptFile.findMany({ where: { invoiceId: id }, include, orderBy: { uploadedAt: "desc" } });
  }

  listForBill(id: string) {
    return this.prisma.receiptFile.findMany({ where: { billId: id }, include, orderBy: { uploadedAt: "desc" } });
  }

  listForJournal(id: string) {
    return this.prisma.receiptFile.findMany({ where: { journalEntryId: id }, include, orderBy: { uploadedAt: "desc" } });
  }

  update(id: string, data: Prisma.ReceiptFileUpdateInput) {
    return this.prisma.receiptFile.update({ where: { id }, data, include });
  }

  listTags() {
    return this.prisma.receiptTag.findMany({ orderBy: { name: "asc" } });
  }

  async ensureTags(names: string[]) {
    const tags = [];
    for (const name of names) {
      const tag = await this.prisma.receiptTag.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      tags.push(tag);
    }
    return tags;
  }

  setTagLinks(receiptId: string, tagIds: string[]) {
    return this.prisma.$transaction([
      this.prisma.receiptFileOnTag.deleteMany({ where: { receiptId } }),
      ...tagIds.map((tagId) => this.prisma.receiptFileOnTag.create({ data: { receiptId, tagId } })),
    ]);
  }

  findBankTransaction(id: string) {
    return this.prisma.bankTransaction.findUnique({
      where: { id },
      include: { bankAccount: true },
    });
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

  listClientBankTransactions(clientId: string) {
    return this.prisma.bankTransaction.findMany({
      where: { bankAccount: { clientId } },
      include: { bankAccount: true },
      orderBy: { date: "desc" },
    });
  }

  updateBankTransaction(
    id: string,
    data: { merchantName?: string | null; enrichment?: Prisma.InputJsonValue },
  ) {
    return this.prisma.bankTransaction.update({ where: { id }, data });
  }

  async evidence(clientId: string) {
    const receipts = await this.prisma.receiptFile.findMany({
      where: { clientId },
      select: {
        id: true,
        bankTransactionId: true,
        invoiceId: true,
        billId: true,
        journalEntryId: true,
        status: true,
      },
    });
    const bills = await this.prisma.purchaseBill.findMany({
      where: { clientId },
      select: { id: true, journalId: true, vatTotal: true },
    });
    const journals = await this.prisma.journalEntry.findMany({
      where: { clientId },
      select: { id: true, source: true, lines: { select: { debit: true, credit: true, ledger: { select: { type: true, code: true } } } } },
    });
    return { receipts, bills, journals };
  }

  listClientInvoices(clientId: string) {
    return this.prisma.salesInvoice.findMany({
      where: { clientId },
      include: { customer: true },
      orderBy: { date: "desc" },
    });
  }

  listClientBills(clientId: string) {
    return this.prisma.purchaseBill.findMany({
      where: { clientId },
      include: { supplier: true },
      orderBy: { date: "desc" },
    });
  }

  markProcessed(
    id: string,
    ocr: {
      text: string;
      merchantName: string | null;
      supplierName?: string | null;
      amount: number | null;
      netAmount?: number | null;
      vatAmount?: number | null;
      vatRate?: number | null;
      date: string | null;
      invoiceNumber?: string | null;
    },
  ) {
    return this.update(id, {
      status: ReceiptStatus.PROCESSED,
      ocrText: ocr.text || null,
      ocrMerchant: ocr.merchantName,
      ocrSupplierName: ocr.supplierName ?? null,
      ocrAmount: ocr.amount ?? null,
      ocrNetAmount: ocr.netAmount ?? null,
      ocrVatAmount: ocr.vatAmount ?? null,
      ocrVatRate: ocr.vatRate ?? null,
      ocrInvoiceNumber: ocr.invoiceNumber ?? null,
      ocrDate: ocr.date ? new Date(`${ocr.date}T00:00:00.000Z`) : null,
    });
  }
}
