import { PublicDocumentKind } from "./document.types";

export interface SearchableDocument {
  id: string;
  fileName: string;
  type: PublicDocumentKind;
  ocrText?: string | null;
  tags: string[];
  ocrMerchant?: string | null;
}

export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

export function scoreDocumentHit(doc: SearchableDocument, query: string): number {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) {
    return 0;
  }
  const hay = {
    fileName: doc.fileName.toLowerCase(),
    ocr: (doc.ocrText ?? "").toLowerCase(),
    merchant: (doc.ocrMerchant ?? "").toLowerCase(),
    tags: doc.tags.map((tag) => tag.toLowerCase()),
    type: doc.type,
  };
  let score = 0;
  for (const token of tokens) {
    if (hay.ocr.includes(token)) {
      score += 3;
    }
    if (hay.fileName.includes(token)) {
      score += 2;
    }
    if (hay.tags.some((tag) => tag.includes(token))) {
      score += 2;
    }
    if (hay.merchant.includes(token)) {
      score += 1;
    }
    if (hay.type.includes(token)) {
      score += 1;
    }
  }
  return score;
}

export function rankDocuments<T extends SearchableDocument>(docs: T[], query: string): Array<T & { score: number }> {
  return docs
    .map((doc) => ({ ...doc, score: scoreDocumentHit(doc, query) }))
    .filter((doc) => doc.score > 0)
    .sort((left, right) => right.score - left.score || left.fileName.localeCompare(right.fileName));
}
