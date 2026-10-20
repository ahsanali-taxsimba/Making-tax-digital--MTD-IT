import { Injectable } from "@nestjs/common";
import { TaxCodeKind } from "@prisma/client";
import { CategorisationRepository } from "./categorisation.repository";
import { MERCHANT_DICTIONARY, matchMerchant } from "./domain/merchant.dictionary";
import { MerchantRule } from "./domain/types";

@Injectable()
export class MerchantDictionaryService {
  constructor(private readonly repo: CategorisationRepository) {}

  async list(): Promise<MerchantRule[]> {
    const rows = await this.repo.listMerchantRules();
    if (rows.length === 0) {
      return MERCHANT_DICTIONARY;
    }
    return rows.map((row) => ({
      merchantKey: row.merchantKey,
      merchantName: row.merchantName,
      aliases: row.aliases,
      categoryKey: row.categoryKey as MerchantRule["categoryKey"],
      ledgerCode: row.ledgerCode,
      taxCodeKind: row.taxCodeKind,
      itsaCategory: row.itsaCategory,
      confidence: Number(row.confidence),
    }));
  }

  async lookup(merchantName: string | null | undefined, description: string): Promise<MerchantRule | null> {
    return matchMerchant(merchantName, description, await this.list());
  }

  catalog() {
    return MERCHANT_DICTIONARY;
  }

  static kind(value: TaxCodeKind): TaxCodeKind {
    return value;
  }
}
