import { Injectable } from "@nestjs/common";
import { DocumentKind } from "@prisma/client";
import { publicKind } from "./domain/document.types";
import { rankDocuments } from "./domain/search";
import { DocumentsRepository } from "./documents.repository";

@Injectable()
export class DocumentSearchService {
  constructor(private readonly repo: DocumentsRepository) {}

  async search(clientId: string, query: string, type?: DocumentKind) {
    const rows = await this.repo.search(clientId, query.trim(), type);
    const ranked = rankDocuments(
      rows.map((row) => ({
        id: row.id,
        fileName: row.fileName,
        type: publicKind(row.type),
        ocrText: row.ocrText,
        tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
        ocrMerchant: row.ocrMerchant,
      })),
      query,
    );
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ranked.map((hit) => ({ row: byId.get(hit.id)!, score: hit.score }));
  }
}
