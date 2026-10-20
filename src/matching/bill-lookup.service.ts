import { Injectable } from "@nestjs/common";
import { MatchableDocument } from "./domain/types";
import { MatchingRepository } from "./matching.repository";

@Injectable()
export class BillLookupService {
  constructor(private readonly repo: MatchingRepository) {}

  async list(clientId: string, excludeIds: string[] = []): Promise<MatchableDocument[]> {
    const rows = await this.repo.listBills(clientId);
    const blocked = new Set(excludeIds);
    return rows.filter((row) => !blocked.has(row.id)).map((row) => this.toDocument(row));
  }

  async get(clientId: string, id: string): Promise<MatchableDocument | null> {
    const row = await this.repo.findBill(clientId, id);
    return row ? this.toDocument(row) : null;
  }

  toDocument(row: {
    id: string;
    date: Date;
    status: string;
    grossTotal: unknown;
    journalId?: string | null;
    supplier?: { name?: string } | null;
    journal?: { reference?: string | null; description?: string } | null;
    lines?: Array<{ description?: string }>;
  }): MatchableDocument {
    return {
      id: row.id,
      kind: "bill",
      date: row.date,
      description: row.lines?.[0]?.description ?? row.journal?.description ?? row.supplier?.name ?? "Purchase bill",
      reference: row.journal?.reference ?? null,
      partyName: row.supplier?.name ?? null,
      grossTotal: Number(row.grossTotal),
      journalId: row.journalId ?? null,
      status: row.status,
    };
  }
}
