import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/types";
import { AuthorizationService } from "../authorization/authorization.service";
import { DigitalLinkNode, DigitalLinks } from "./domain/audit.types";
import { parsePeriod } from "./domain/period";

const DOCUMENT_INCLUDE = {
  bankTransaction: { include: { matchedJournal: true } },
  journal: true,
  invoice: true,
  vatReturn: true,
  itsaSubmission: true,
} as const;

@Injectable()
export class DigitalLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  async build(user: AuthUser, resourceId: string, chain: "vat" | "itsa" | "invoice" = "vat"): Promise<DigitalLinks> {
    this.authz.assertCanAccessClientData(user, { firmId: user.firmId });
    const firmId = user.firmId;
    let document = await this.findDocument(firmId, resourceId);
    let bank = document?.bankTransaction ?? (await this.findBank(firmId, resourceId));
    let journal = document?.journal ?? bank?.matchedJournal ?? (await this.findJournal(firmId, resourceId));
    let invoice = document?.invoice ?? (await this.findInvoice(firmId, resourceId));
    let vat =
      document?.vatReturn ??
      (await this.findVat(firmId, resourceId)) ??
      (await this.findVatForClient(firmId, document?.clientId ?? invoice?.clientId ?? journal?.clientId, journal?.date ?? invoice?.date));
    let quarterly = document?.itsaSubmission ?? (await this.findItsaUpdate(firmId, resourceId, document?.clientId));

    if (!document && vat) {
      document = await this.findDocumentByLink(firmId, { vatReturnId: vat.id });
    }
    if (!document && invoice) {
      document = await this.findDocumentByLink(firmId, { invoiceId: invoice.id });
    }
    if (!document && bank) {
      document = await this.findDocumentByLink(firmId, { bankTransactionId: bank.id });
    }
    if (!document && journal) {
      document = await this.findDocumentByLink(firmId, { journalEntryId: journal.id });
    }
    if (!document && quarterly) {
      document = await this.findDocumentByLink(firmId, { itsaSubmissionId: quarterly.id });
    }

    if (document) {
      bank = bank ?? document.bankTransaction ?? null;
      journal = journal ?? document.journal ?? bank?.matchedJournal ?? null;
      invoice = invoice ?? document.invoice ?? null;
      vat = vat ?? document.vatReturn ?? null;
      quarterly = quarterly ?? document.itsaSubmission ?? null;
    }
    if (!vat) {
      vat = await this.findVatForClient(
        firmId,
        document?.clientId ?? invoice?.clientId ?? journal?.clientId,
        journal?.date ?? invoice?.date,
      );
    }

    const eops = quarterly ? await this.findEops(firmId, quarterly.clientId, quarterly.taxYear) : await this.findEopsById(firmId, resourceId);
    const final = quarterly
      ? await this.findFinal(firmId, quarterly.clientId, quarterly.taxYear)
      : await this.findFinalById(firmId, resourceId);

    if (!document && !bank && !journal && !invoice && !vat && !quarterly && !eops && !final) {
      throw new NotFoundException("No digital-link resource found");
    }

    const nodes = {
      document: node("document", document?.id, document ? document.fileName : "Document", document, document),
      bankTransaction: node(
        "bank_transaction",
        bank?.id,
        bank ? String(bank.description) : "Bank transaction",
        bank,
        bank,
      ),
      journalEntry: node("journal", journal?.id, journal ? journal.reference ?? journal.id : "Journal entry", journal, journal),
      extraction: node(
        "extraction",
        document?.id ?? null,
        "Invoice extraction",
        Boolean(document?.extractedData),
        document?.extractedData
          ? { status: document.extractionStatus, confidence: document.extractionConfidence, data: document.extractedData }
          : null,
      ),
      invoice: node("invoice", invoice?.id, invoice ? invoice.invoiceNumber ?? invoice.id : "Invoice", invoice, invoice),
      vatReturn: node(
        "vat_return",
        vat?.id,
        vat ? vat.periodKey : "VAT return",
        vat,
        vat
          ? {
              periodKey: vat.periodKey,
              status: vat.status,
              hmrcSubmissionId: vat.formBundleNumber ?? vat.correlationId,
              periodStart: vat.periodStart,
              periodEnd: vat.periodEnd,
            }
          : null,
      ),
      quarterlyUpdate: node(
        "itsa_submission",
        quarterly?.id,
        quarterly ? `${quarterly.taxYear} ${quarterly.periodId}` : "Quarterly update",
        quarterly,
        quarterly,
      ),
      eops: node("itsa_eops", eops?.id, eops ? `EOPS ${eops.taxYear}` : "EOPS", eops, eops),
      finalDeclaration: node(
        "itsa_final",
        final?.id,
        final ? `Final ${final.taxYear}` : "Final declaration",
        final,
        final,
      ),
    };

    const path =
      chain === "itsa"
        ? ["document", "bankTransaction", "journalEntry", "quarterlyUpdate", "eops", "finalDeclaration"]
        : chain === "invoice"
          ? ["document", "extraction", "invoice", "vatReturn"]
          : ["document", "bankTransaction", "journalEntry", "vatReturn"];

    return { chain, resourceId, ...nodes, path };
  }

  async forClientPeriod(user: AuthUser, clientId?: string, period?: string): Promise<DigitalLinks[]> {
    this.authz.assertCanAccessClientData(user, { firmId: user.firmId, clientId: clientId ?? null });
    const range = parsePeriod(period);
    const clientFilter = { firmId: user.firmId, ...(clientId ? { id: clientId } : {}) };
    const createdAt = range ? { gte: range.start, lte: range.end } : undefined;
    const [vats, invoices, updates] = await Promise.all([
      this.prisma.vatReturn.findMany({
        where: { client: clientFilter, ...(createdAt ? { createdAt } : {}) },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true },
      }),
      this.prisma.salesInvoice.findMany({
        where: { client: clientFilter, ...(createdAt ? { createdAt } : {}) },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true },
      }),
      this.prisma.itsaUpdate.findMany({
        where: { client: clientFilter, ...(createdAt ? { createdAt } : {}) },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true },
      }),
    ]);
    const links: DigitalLinks[] = [];
    for (const vat of vats) {
      links.push(await this.build(user, vat.id, "vat"));
    }
    for (const invoice of invoices) {
      links.push(await this.build(user, invoice.id, "invoice"));
    }
    for (const update of updates) {
      links.push(await this.build(user, update.id, "itsa"));
    }
    return links;
  }

  private findDocument(firmId: string, id: string) {
    return this.prisma.documentFile.findFirst({
      where: { id, firmId },
      include: DOCUMENT_INCLUDE,
    });
  }

  private findDocumentByLink(
    firmId: string,
    where: {
      vatReturnId?: string;
      invoiceId?: string;
      bankTransactionId?: string;
      journalEntryId?: string;
      itsaSubmissionId?: string;
    },
  ) {
    return this.prisma.documentFile.findFirst({
      where: { firmId, ...where },
      include: DOCUMENT_INCLUDE,
    });
  }

  private findBank(firmId: string, id: string) {
    return this.prisma.bankTransaction.findFirst({
      where: { id, bankAccount: { client: { firmId } } },
      include: { matchedJournal: true, documents: true },
    });
  }

  private findJournal(firmId: string, id: string) {
    return this.prisma.journalEntry.findFirst({ where: { id, firmId } });
  }

  private findInvoice(firmId: string, id: string) {
    return this.prisma.salesInvoice.findFirst({ where: { id, client: { firmId } } });
  }

  private findVat(firmId: string, id: string) {
    return this.prisma.vatReturn.findFirst({ where: { id, client: { firmId } } });
  }

  private findVatForClient(firmId: string, clientId?: string | null, around?: Date | null) {
    if (!clientId) {
      return null;
    }
    return this.prisma.vatReturn.findFirst({
      where: {
        clientId,
        client: { firmId },
        ...(around ? { periodStart: { lte: around }, periodEnd: { gte: around } } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  private async findItsaUpdate(firmId: string, id: string, clientId?: string | null) {
    const byId = await this.prisma.itsaUpdate.findFirst({ where: { id, client: { firmId } } });
    if (byId) {
      return byId;
    }
    if (!clientId) {
      return null;
    }
    return this.prisma.itsaUpdate.findFirst({
      where: { clientId, client: { firmId } },
      orderBy: { createdAt: "desc" },
    });
  }

  private findEops(firmId: string, clientId: string, taxYear: string) {
    return this.prisma.itsaEndOfPeriodStatement.findFirst({ where: { clientId, taxYear, client: { firmId } } });
  }

  private findEopsById(firmId: string, id: string) {
    return this.prisma.itsaEndOfPeriodStatement.findFirst({ where: { id, client: { firmId } } });
  }

  private findFinal(firmId: string, clientId: string, taxYear: string) {
    return this.prisma.itsaFinalDeclaration.findFirst({ where: { clientId, taxYear, client: { firmId } } });
  }

  private findFinalById(firmId: string, id: string) {
    return this.prisma.itsaFinalDeclaration.findFirst({ where: { id, client: { firmId } } });
  }
}

function node(
  type: string,
  id: string | null | undefined,
  label: string,
  linked: unknown,
  detail: unknown,
): DigitalLinkNode {
  return {
    type,
    id: id ?? null,
    label,
    linked: Boolean(linked && id),
    detail: detail && typeof detail === "object" ? (detail as Record<string, unknown>) : null,
  };
}
