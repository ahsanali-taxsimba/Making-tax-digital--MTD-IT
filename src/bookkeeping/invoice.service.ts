import { Injectable } from "@nestjs/common";
import { JournalSource, PartyKind } from "@prisma/client";
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
}

function lineVat(taxCodeId: string | undefined, net: number, taxCodes: TaxCodeSnapshot[]): number {
  const tax = taxCodeId ? taxCodes.find((item) => item.id === taxCodeId) : undefined;
  return tax ? vatOnNet(net, tax) : 0;
}
