import { ChartProfile, TaxCodeKind } from "@prisma/client";
import { LedgerSnapshot, TaxCodeSnapshot } from "../../bookkeeping/domain/journal.rules";
import { lookupItsaMapping } from "../../itsa/mtd-itsa.mapping";
import { lookupVatMapping } from "../../vat/vat-box.mapping";
import { suggestDocumentMatch } from "../../yapily/domain/invoice-match";
import { defaultExpenseCode, defaultIncomeCode, ledgerCodeFor } from "./category-ledger";
import { buildDraftJournal, resolveBankAndVat } from "./journal-draft";
import { matchMcc } from "./mcc.mapping";
import { matchMerchant } from "./merchant.dictionary";
import { isRecurringAmount, looksLikeBill, looksLikeInvoice, looksLikeSubscription, resolveSignals } from "./scoring";
import { inferTaxCodeKind, taxKindToCode } from "./vat.inference";
import { Classification, ClassifyContext, ClassifyInput, ClassifySignal, MerchantRule, MccRule } from "./types";

const CATEGORY_HINTS: Array<{ match: RegExp; categoryKey: Parameters<typeof ledgerCodeFor>[1]; tax?: TaxCodeKind }> = [
  { match: /advert|marketing|ads\b/i, categoryKey: "advertising" },
  { match: /fuel|petrol|diesel|motor/i, categoryKey: "fuel" },
  { match: /tesco|sainsbury|grocer|supermarket/i, categoryKey: "groceries" },
  { match: /restaurant|cafe|dining|meal/i, categoryKey: "restaurants" },
  { match: /fee|charge|interest/i, categoryKey: "bank_charges", tax: TaxCodeKind.NO_VAT },
  { match: /subscription|saas|software/i, categoryKey: "subscriptions" },
  { match: /gallery|studio sales|receipts|turnover|invoice/i, categoryKey: "sales" },
  { match: /rent|letting/i, categoryKey: "rent" },
  { match: /insurance/i, categoryKey: "insurance", tax: TaxCodeKind.NO_VAT },
];

export function classifyTransaction(txn: ClassifyInput, context: ClassifyContext): Classification {
  const merchant = matchMerchant(txn.merchantName, txn.description, context.merchantRules);
  const mcc = matchMcc(txn.merchantCategoryCode, context.mccRules);
  const signals = collectSignals(txn, context, merchant, mcc);
  const { winner, confidence, reasons } = resolveSignals(signals);
  const ledgerCode = winner.ledgerCode;
  const counterpart = findLedger(context.ledgers, ledgerCode, context.profile) ?? fallbackLedger(context, txn.type);
  const taxCodeKind = inferTaxCodeKind({
    type: txn.type,
    merchantCategoryCode: txn.merchantCategoryCode,
    merchantRule: merchant,
    mccRule: mcc,
    transactionCategory: txn.transactionCategory ?? txn.category,
    description: txn.description,
  });
  const tax = findTax(context.taxCodes, taxCodeKind);
  const itsa = lookupItsaMapping(context.profile, counterpart.code);
  const vat = lookupVatMapping(context.profile, counterpart.code);
  const controls = resolveBankAndVat(context.ledgers, context.profile);
  const draftJournal = buildDraftJournal({
    txn,
    counterpart,
    bank: controls.bank,
    tax,
    taxCodeKind,
    outputVat: controls.outputVat ?? undefined,
    inputVat: controls.inputVat ?? undefined,
  });

  return {
    ledgerCode: counterpart.code,
    ledgerAccountId: counterpart.id,
    ledgerName: counterpart.name,
    taxCodeKind,
    taxCodeId: tax?.id ?? null,
    taxCode: tax?.code ?? taxKindToCode(taxCodeKind),
    taxRate: tax ? Number(tax.rate) : 0,
    itsaCategory: merchant?.itsaCategory ?? mcc?.itsaCategory ?? itsa?.category ?? null,
    itsaBucket: itsa?.bucket ?? null,
    itsaHmrcKey: itsa?.hmrcKey ?? null,
    includedInQuarterlyUpdate: itsa?.includedInQuarterlyUpdate ?? null,
    vatBoxes: vat?.boxes ?? [],
    confidence,
    reasons,
    draftJournal,
  };
}

function collectSignals(
  txn: ClassifyInput,
  context: ClassifyContext,
  merchant: MerchantRule | null,
  mcc: MccRule | null,
): ClassifySignal[] {
  const signals: ClassifySignal[] = [];
  if (merchant) {
    signals.push({
      name: "merchant_dictionary",
      ledgerCode: ledgerCodeFor(context.profile, merchant.categoryKey, merchant.ledgerCode),
      categoryKey: merchant.categoryKey,
      taxCodeKind: merchant.taxCodeKind,
      confidence: merchant.confidence,
      detail: merchant.merchantName,
    });
  }
  if (mcc) {
    signals.push({
      name: "mcc",
      ledgerCode: ledgerCodeFor(context.profile, mcc.categoryKey, mcc.ledgerCode),
      categoryKey: mcc.categoryKey,
      taxCodeKind: mcc.taxCodeKind,
      confidence: mcc.confidence,
      detail: `${mcc.mcc}:${mcc.industry}`,
    });
  }

  const categoryText = `${txn.transactionCategory ?? ""} ${txn.category ?? ""} ${txn.labels?.join(" ") ?? ""}`;
  const hint = CATEGORY_HINTS.find((rule) => rule.match.test(categoryText) || rule.match.test(txn.description));
  if (hint) {
    signals.push({
      name: "merchant_category",
      ledgerCode: ledgerCodeFor(context.profile, hint.categoryKey),
      categoryKey: hint.categoryKey,
      taxCodeKind: hint.tax,
      confidence: 0.7,
      detail: hint.categoryKey,
    });
  }

  if (looksLikeSubscription(txn.description, txn.merchantName) || isRecurringAmount(txn.amount, txn.merchantName, txn.description, context.siblings)) {
    signals.push({
      name: "amount_pattern",
      ledgerCode: ledgerCodeFor(context.profile, "subscriptions"),
      categoryKey: "subscriptions",
      taxCodeKind: TaxCodeKind.VAT_STANDARD,
      confidence: 0.65,
      detail: "recurring_subscription",
    });
  }

  if (looksLikeInvoice(txn.description) && txn.type === "CREDIT") {
    signals.push({
      name: "description_pattern",
      ledgerCode: defaultIncomeCode(context.profile),
      categoryKey: "sales",
      taxCodeKind: TaxCodeKind.VAT_STANDARD,
      confidence: 0.72,
      detail: "invoice",
    });
  }
  if (looksLikeBill(txn.description) && txn.type === "DEBIT") {
    signals.push({
      name: "description_pattern",
      ledgerCode: merchant ? ledgerCodeFor(context.profile, merchant.categoryKey, merchant.ledgerCode) : defaultExpenseCode(context.profile),
      confidence: 0.72,
      detail: "bill",
    });
  }

  if (context.documents?.length) {
    const match = suggestDocumentMatch(
      {
        date: txn.date,
        amount: txn.amount,
        type: txn.type,
        description: txn.description,
        merchantName: txn.merchantName,
      },
      context.documents,
    );
    if (match) {
      signals.push({
        name: "document_match",
        ledgerCode: txn.type === "CREDIT" ? defaultIncomeCode(context.profile) : defaultExpenseCode(context.profile),
        confidence: Math.min(0.92, 0.6 + match.score / 500),
        detail: `${match.kind}:${match.documentId}`,
      });
    }
  }

  if (signals.length === 0) {
    signals.push({
      name: "fallback",
      ledgerCode: txn.type === "CREDIT" ? defaultIncomeCode(context.profile) : defaultExpenseCode(context.profile),
      taxCodeKind: txn.type === "CREDIT" ? TaxCodeKind.VAT_STANDARD : TaxCodeKind.NO_VAT,
      confidence: 0.4,
      detail: txn.type === "CREDIT" ? "income" : "expense",
    });
  }
  return signals;
}

function findLedger(ledgers: LedgerSnapshot[], code: number, profile: ChartProfile): LedgerSnapshot | undefined {
  return ledgers.find((item) => item.code === code && item.profile === profile) ?? ledgers.find((item) => item.code === code);
}

function fallbackLedger(context: ClassifyContext, type: ClassifyInput["type"]): LedgerSnapshot {
  const code = type === "CREDIT" ? defaultIncomeCode(context.profile) : defaultExpenseCode(context.profile);
  const found = findLedger(context.ledgers, code, context.profile);
  if (!found) {
    throw new Error(`Missing fallback ledger ${code}`);
  }
  return found;
}

function findTax(taxCodes: TaxCodeSnapshot[], kind: TaxCodeKind): TaxCodeSnapshot | null {
  return (
    taxCodes.find((tax) => tax.type === kind) ??
    taxCodes.find((tax) => tax.code === taxKindToCode(kind)) ??
    null
  );
}
