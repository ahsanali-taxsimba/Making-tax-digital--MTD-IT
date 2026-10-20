import { Injectable, NotFoundException } from "@nestjs/common";
import { DocumentStatus, JournalSource, PartyKind } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { defaultProfileForClientType, toChartProfile } from "../ledger/chart-of-accounts.catalog";
import { BookkeepingRepository } from "./bookkeeping.repository";
import { BookkeepingError, BK_ERR } from "./bookkeeping.errors";
import { CreateBillDto, CreateInvoiceDto } from "./dto/bookkeeping.dto";
import { LedgerSnapshot, TaxCodeSnapshot, toTaxSnapshot } from "./domain/journal.rules";
import { purchaseBillLines, salesInvoiceLines } from "./domain/posting";
import { assertJournalTaxCodes, vatOnNet } from "./domain/tax.rules";
import { JournalService } from "./journal.service";

@Injectable()
export class InvoiceService {
  constructor(
    private readonly repo: BookkeepingRepository,
    private readonly clients: ClientsService,
    private readonly journals: JournalService,
    private readonly audit: AuditService,
  ) {}

  listInvoices(user: AuthUser, clientId: string) {
    return this.clients.get(user, clientId).then(() => this.repo.listInvoices(clientId));
  }

  listBills(user: AuthUser, clientId: string) {
    return this.clients.get(user, clientId).then(() => this.repo.listBills(clientId));
  }

  async getInvoice(user: AuthUser, id: string) {
    const invoice = await this.repo.findInvoice(id);
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    await this.clients.get(user, invoice.clientId);
    return this.publicSales(invoice);
  }

  async getBill(user: AuthUser, id: string) {
    const bill = await this.repo.findBill(id);
    if (!bill) {
      throw new NotFoundException("Bill not found");
    }
    await this.clients.get(user, bill.clientId);
    return this.publicPurchase(bill);
  }

  async postDraftInvoice(user: AuthUser, id: string) {
    const invoice = await this.requireDraftInvoice(user, id);
    const client = await this.clients.get(user, invoice.clientId);
    const preview = await this.buildSalesPreview(client, invoice);
    const journal = await this.journals.post(user, {
      clientId: client.id,
      firmId: client.firmId,
      date: isoDate(invoice.date),
      description: `Sales invoice ${invoice.invoiceNumber ?? invoice.customer.name}`,
      source: JournalSource.INVOICE,
      lines: preview.draftLines,
    });
    const posted = await this.repo.updateInvoiceJournal(invoice.id, journal.id);
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "bookkeeping.invoice.posted",
      resourceType: "invoice",
      resourceId: invoice.id,
      beforeData: { status: invoice.status, invoiceNumber: invoice.invoiceNumber ?? null, journalId: invoice.journalId ?? null },
      afterData: { status: DocumentStatus.POSTED, invoiceNumber: invoice.invoiceNumber ?? null, journalId: journal.id },
      metadata: { invoiceId: invoice.id, journalId: journal.id },
    });
    return { ...this.publicSales({ ...invoice, ...posted, journal, status: DocumentStatus.POSTED }), journal };
  }

  async postDraftBill(user: AuthUser, id: string) {
    const bill = await this.requireDraftBill(user, id);
    const client = await this.clients.get(user, bill.clientId);
    const preview = await this.buildPurchasePreview(client, bill);
    const journal = await this.journals.post(user, {
      clientId: client.id,
      firmId: client.firmId,
      date: isoDate(bill.date),
      description: `Purchase bill ${bill.invoiceNumber ?? bill.supplier.name}`,
      source: JournalSource.BILL,
      lines: preview.draftLines,
    });
    const posted = await this.repo.updateBillJournal(bill.id, journal.id);
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "bookkeeping.bill.posted",
      resourceType: "bill",
      resourceId: bill.id,
      beforeData: { status: bill.status, invoiceNumber: bill.invoiceNumber ?? null, journalId: bill.journalId ?? null },
      afterData: { status: DocumentStatus.POSTED, invoiceNumber: bill.invoiceNumber ?? null, journalId: journal.id },
      metadata: { billId: bill.id, journalId: journal.id },
    });
    return { ...this.publicPurchase({ ...bill, ...posted, journal, status: DocumentStatus.POSTED }), journal };
  }

  async journalPreviewForInvoice(user: AuthUser, id: string) {
    const invoice = await this.repo.findInvoice(id);
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    const client = await this.clients.get(user, invoice.clientId);
    return this.buildSalesPreview(client, invoice);
  }

  async journalPreviewForBill(user: AuthUser, id: string) {
    const bill = await this.repo.findBill(id);
    if (!bill) {
      throw new NotFoundException("Bill not found");
    }
    const client = await this.clients.get(user, bill.clientId);
    return this.buildPurchasePreview(client, bill);
  }

  async createInvoice(user: AuthUser, dto: CreateInvoiceDto) {
    const client = await this.clients.get(user, dto.clientId);
    const profile = dto.profile ? toChartProfile(dto.profile) : defaultProfileForClientType(client.type);
    const [accounts, taxCodes] = await Promise.all([
      this.repo.listLedgers(client.id, profile),
      this.repo.listTaxCodes(),
    ]);
    const taxes = taxCodes.map(toTaxSnapshot);
    const built = salesInvoiceLines(dto.lines, accounts as LedgerSnapshot[], taxes, profile);
    assertJournalTaxCodes(built.lines, accounts as LedgerSnapshot[], taxes);
    const customer = await this.repo.ensureParty(client.id, PartyKind.CUSTOMER, dto.customerId, dto.customerName);
    if (!customer) {
      throw new BookkeepingError(BK_ERR.INVALID_ACCOUNT, "Customer does not belong to this client");
    }
    const journal = await this.journals.post(user, {
      clientId: client.id,
      firmId: client.firmId,
      date: dto.date,
      description: `Sales invoice ${dto.customerName ?? customer.name}`,
      source: JournalSource.INVOICE,
      lines: built.lines,
      profile,
    });
    const invoice = await this.repo.createInvoice({
      client: { connect: { id: client.id } },
      customer: { connect: { id: customer.id } },
      date: this.repo.toDate(dto.date),
      dueDate: this.repo.toDate(dto.dueDate),
      status: "POSTED",
      netTotal: built.netTotal,
      vatTotal: built.vatTotal,
      grossTotal: built.grossTotal,
      journal: { connect: { id: journal.id } },
      lines: {
        create: dto.lines.map((line) => ({
          description: line.description,
          net: line.net,
          vat: lineVat(line.taxCodeId, line.net, taxes),
          taxCodeId: line.taxCodeId,
          ledgerId: line.ledgerId,
        })),
      },
    });
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "bookkeeping.invoice.posted",
      metadata: { invoiceId: invoice.id, journalId: journal.id },
    });
    return { ...invoice, journal, vatBreakdown: { net: built.netTotal, vat: built.vatTotal, gross: built.grossTotal } };
  }

  async createBill(user: AuthUser, dto: CreateBillDto) {
    const client = await this.clients.get(user, dto.clientId);
    const profile = dto.profile ? toChartProfile(dto.profile) : defaultProfileForClientType(client.type);
    const [accounts, taxCodes] = await Promise.all([
      this.repo.listLedgers(client.id, profile),
      this.repo.listTaxCodes(),
    ]);
    const taxes = taxCodes.map(toTaxSnapshot);
    const built = purchaseBillLines(dto.lines, accounts as LedgerSnapshot[], taxes, profile);
    assertJournalTaxCodes(built.lines, accounts as LedgerSnapshot[], taxes);
    const supplier = await this.repo.ensureParty(client.id, PartyKind.SUPPLIER, dto.supplierId, dto.supplierName);
    if (!supplier) {
      throw new BookkeepingError(BK_ERR.INVALID_ACCOUNT, "Supplier does not belong to this client");
    }
    const journal = await this.journals.post(user, {
      clientId: client.id,
      firmId: client.firmId,
      date: dto.date,
      description: `Purchase bill ${dto.supplierName ?? supplier.name}`,
      source: JournalSource.BILL,
      lines: built.lines,
      profile,
    });
    const bill = await this.repo.createBill({
      client: { connect: { id: client.id } },
      supplier: { connect: { id: supplier.id } },
      date: this.repo.toDate(dto.date),
      dueDate: this.repo.toDate(dto.dueDate),
      status: "POSTED",
      netTotal: built.netTotal,
      vatTotal: built.vatTotal,
      grossTotal: built.grossTotal,
      journal: { connect: { id: journal.id } },
      lines: {
        create: dto.lines.map((line) => ({
          description: line.description,
          net: line.net,
          vat: lineVat(line.taxCodeId, line.net, taxes),
          taxCodeId: line.taxCodeId,
          ledgerId: line.ledgerId,
        })),
      },
    });
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "bookkeeping.bill.posted",
      metadata: { billId: bill.id, journalId: journal.id },
    });
    return { ...bill, journal, vatBreakdown: { net: built.netTotal, vat: built.vatTotal, gross: built.grossTotal } };
  }

  private async requireDraftInvoice(user: AuthUser, id: string) {
    const invoice = await this.repo.findInvoice(id);
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    await this.clients.get(user, invoice.clientId);
    if (invoice.status === DocumentStatus.POSTED || invoice.journalId) {
      throw new BookkeepingError(BK_ERR.ALREADY_POSTED, "Invoice is already posted to the ledger");
    }
    return invoice;
  }

  private async requireDraftBill(user: AuthUser, id: string) {
    const bill = await this.repo.findBill(id);
    if (!bill) {
      throw new NotFoundException("Bill not found");
    }
    await this.clients.get(user, bill.clientId);
    if (bill.status === DocumentStatus.POSTED || bill.journalId) {
      throw new BookkeepingError(BK_ERR.ALREADY_POSTED, "Bill is already posted to the ledger");
    }
    return bill;
  }

  private async buildSalesPreview(
    client: { id: string; type: string },
    invoice: {
      invoiceNumber?: string | null;
      customer: { name: string };
      lines: Array<{ description: string; net: unknown; vat: unknown; taxCodeId?: string | null; ledgerId?: string | null }>;
    },
  ) {
    const profile = defaultProfileForClientType(client.type as never);
    const [accounts, taxCodes] = await Promise.all([this.repo.listLedgers(client.id, profile), this.repo.listTaxCodes()]);
    const taxes = taxCodes.map(toTaxSnapshot);
    const built = salesInvoiceLines(asDocumentLines(invoice.lines), accounts as LedgerSnapshot[], taxes, profile);
    return this.publicPreview("sales", built, accounts as Array<{ id: string; code: number; name: string }>, invoice.customer.name, invoice.invoiceNumber);
  }

  private async buildPurchasePreview(
    client: { id: string; type: string },
    bill: {
      invoiceNumber?: string | null;
      supplier: { name: string };
      lines: Array<{ description: string; net: unknown; vat: unknown; taxCodeId?: string | null; ledgerId?: string | null }>;
    },
  ) {
    const profile = defaultProfileForClientType(client.type as never);
    const [accounts, taxCodes] = await Promise.all([this.repo.listLedgers(client.id, profile), this.repo.listTaxCodes()]);
    const taxes = taxCodes.map(toTaxSnapshot);
    const built = purchaseBillLines(asDocumentLines(bill.lines), accounts as LedgerSnapshot[], taxes, profile);
    return this.publicPreview("purchase", built, accounts as Array<{ id: string; code: number; name: string }>, bill.supplier.name, bill.invoiceNumber);
  }

  private publicPreview(
    kind: "sales" | "purchase",
    built: { lines: Array<{ ledgerAccountId: string; debit: number; credit: number; description?: string | null }>; netTotal: number; vatTotal: number; grossTotal: number },
    accounts: Array<{ id: string; code: number; name: string }>,
    partyName: string,
    invoiceNumber?: string | null,
  ) {
    const byId = new Map(accounts.map((account) => [account.id, account]));
    return {
      kind,
      partyName,
      invoiceNumber: invoiceNumber ?? null,
      netTotal: built.netTotal,
      vatTotal: built.vatTotal,
      grossTotal: built.grossTotal,
      draftLines: built.lines,
      lines: built.lines.map((line) => ({
        accountCode: byId.get(line.ledgerAccountId)?.code ?? null,
        accountName: byId.get(line.ledgerAccountId)?.name ?? "Ledger",
        debit: line.debit,
        credit: line.credit,
        description: line.description ?? "",
      })),
    };
  }

  private publicSales(invoice: {
    id: string;
    clientId: string;
    date: Date;
    dueDate: Date;
    status: DocumentStatus;
    invoiceNumber?: string | null;
    netTotal: unknown;
    vatTotal: unknown;
    grossTotal: unknown;
    journalId?: string | null;
    customer?: { id: string; name: string } | null;
    lines?: Array<{ id: string; description: string; net: unknown; vat: unknown }>;
    journal?: unknown;
    documents?: unknown[];
    receipts?: unknown[];
  }) {
    return {
      kind: "sales" as const,
      id: invoice.id,
      clientId: invoice.clientId,
      partyName: invoice.customer?.name ?? "Customer",
      partyId: invoice.customer?.id ?? null,
      invoiceNumber: invoice.invoiceNumber ?? null,
      date: isoDate(invoice.date),
      dueDate: isoDate(invoice.dueDate),
      status: invoice.status,
      netTotal: Number(invoice.netTotal),
      vatTotal: Number(invoice.vatTotal),
      grossTotal: Number(invoice.grossTotal),
      journalId: invoice.journalId ?? null,
      lines: (invoice.lines ?? []).map((line) => ({
        id: line.id,
        description: line.description,
        net: Number(line.net),
        vat: Number(line.vat),
        gross: Number(line.net) + Number(line.vat),
      })),
      journal: invoice.journal ?? null,
      documents: invoice.documents ?? [],
      receipts: invoice.receipts ?? [],
      readyToPost: invoice.status === DocumentStatus.DRAFT && !invoice.journalId,
    };
  }

  private publicPurchase(bill: {
    id: string;
    clientId: string;
    date: Date;
    dueDate: Date;
    status: DocumentStatus;
    invoiceNumber?: string | null;
    netTotal: unknown;
    vatTotal: unknown;
    grossTotal: unknown;
    journalId?: string | null;
    supplier?: { id: string; name: string } | null;
    lines?: Array<{ id: string; description: string; net: unknown; vat: unknown }>;
    journal?: unknown;
    documents?: unknown[];
    receipts?: unknown[];
  }) {
    return {
      kind: "purchase" as const,
      id: bill.id,
      clientId: bill.clientId,
      partyName: bill.supplier?.name ?? "Supplier",
      partyId: bill.supplier?.id ?? null,
      invoiceNumber: bill.invoiceNumber ?? null,
      date: isoDate(bill.date),
      dueDate: isoDate(bill.dueDate),
      status: bill.status,
      netTotal: Number(bill.netTotal),
      vatTotal: Number(bill.vatTotal),
      grossTotal: Number(bill.grossTotal),
      journalId: bill.journalId ?? null,
      lines: (bill.lines ?? []).map((line) => ({
        id: line.id,
        description: line.description,
        net: Number(line.net),
        vat: Number(line.vat),
        gross: Number(line.net) + Number(line.vat),
      })),
      journal: bill.journal ?? null,
      documents: bill.documents ?? [],
      receipts: bill.receipts ?? [],
      readyToPost: bill.status === DocumentStatus.DRAFT && !bill.journalId,
    };
  }
}

function lineVat(taxCodeId: string | undefined, net: number, taxCodes: TaxCodeSnapshot[]): number {
  const tax = taxCodeId ? taxCodes.find((item) => item.id === taxCodeId) : undefined;
  return tax ? vatOnNet(net, tax) : 0;
}

function asDocumentLines(lines: Array<{ description: string; net: unknown; vat: unknown; taxCodeId?: string | null; ledgerId?: string | null }>) {
  return lines.map((line) => ({
    description: line.description,
    net: Number(line.net),
    vat: Number(line.vat),
    taxCodeId: line.taxCodeId ?? undefined,
    ledgerId: line.ledgerId ?? undefined,
  }));
}

function isoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}
