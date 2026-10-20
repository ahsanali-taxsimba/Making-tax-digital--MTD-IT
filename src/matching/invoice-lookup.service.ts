import { Injectable } from "@nestjs/common";
import { MatchableDocument } from "./domain/types";
import { MatchingRepository } from "./matching.repository";

@Injectable()
export class InvoiceLookupService {
  constructor(private readonly repo: MatchingRepository) {}

  async list(clientId: string, excludeIds: string[] = []): Promise<MatchableDocument[]> {
    const rows = await this.repo.listInvoices(clientId);
    const blocked = new Set(excludeIds);
    return rows.filter((row) => !blocked.has(row.id)).map((row) => this.toDocument(row));
  }

  async get(clientId: string, id: string): Promise<MatchableDocument | null> {
    const row = await this.repo.findInvoice(clientId, id);
    return row ? this.toDocument(row) : null;
  }

  toDocument(row: {
    id: string;
    date: Date;
    status: string;
    grossTotal: unknown;
    journalId?: string | null;
    customer?: { name?: string } | null;
    journal?: { reference?: string | null; description?: string } | null;
    lines?: Array<{ description?: string }>;
  }): MatchableDocument {
    return {
      id: row.id,
      kind: "invoice",
      date: row.date,
      description: row.lines?.[0]?.description ?? row.journal?.description ?? row.customer?.name ?? "Sales invoice",
      reference: row.journal?.reference ?? null,
      partyName: row.customer?.name ?? null,
      grossTotal: Number(row.grossTotal),
      journalId: row.journalId ?? null,
      status: row.status,
    };
  }
}
