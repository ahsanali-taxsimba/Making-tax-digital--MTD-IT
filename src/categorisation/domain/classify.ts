import { ChartProfile, TaxCodeKind } from "@prisma/client";
import { LedgerSnapshot, TaxCodeSnapshot } from "../../bookkeeping/domain/journal.rules";
import { lookupItsaMapping } from "../../itsa/mtd-itsa.mapping";
import { lookupVatMapping } from "../../vat/vat-box.mapping";
import { suggestDocumentMatch } from "../../yapily/domain/invoice-match";
import { defaultExpenseCode, defaultIncomeCode, ledgerCodeFor } from "./category-ledger";
import { scoreConfidence } from "./confidence";
import { buildDraftJournal, resolveBankAndVat } from "./journal-draft";
import { matchMcc } from "./mcc.mapping";
import { matchMerchant } from "./merchant.dictionary";
import { defaultCategorisationModel } from "./naive-bayes";
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
  const merchant = matchMerchant(txn.merchantName ?? txn.ocrMerchantName, `${txn.description} ${txn.ocrText ?? ""}`, context.merchantRules);
  const mcc = matchMcc(txn.merchantCategoryCode, context.mccRules);
  const model = (context.model ?? defaultCategorisationModel()).predict(txn, context.profile);
  const signals = collectSignals(txn, context, merchant, mcc, model);
  const resolved = resolveSignals(signals);
  const counterpart = findLedger(context.ledgers, resolved.winner.ledgerCode, context.profile) ?? fallbackLedger(context, txn.type);
  const recurring = looksLikeSubscription(txn.description, txn.merchantName) || isRecurringAmount(txn.amount, txn.merchantName, txn.description, context.siblings);
  const scored = scoreConfidence(txn, {
    merchantRule: merchant,
    model,
    ruleScore: resolved.confidence,
    winnerLedgerCode: counterpart.code,
    siblings: context.siblings,
  }, recurring);
  const taxCodeKind = inferTaxCodeKind({
    type: txn.type,
    merchantCategoryCode: txn.merchantCategoryCode,
    merchantRule: merchant,
    mccRule: mcc,
    transactionCategory: txn.transactionCategory ?? txn.category,
    description: `${txn.description} ${txn.ocrText ?? ""}`,
    ocrVatRate: txn.ocrVatRate,
    ocrVatAmount: txn.ocrVatAmount,
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
    confidence: scored.confidence,
    reasons: [...resolved.reasons, ...scored.reasons],
    draftJournal,
    model,
    confidenceBreakdown: scored.breakdown,
  };
}

function collectSignals(
  txn: ClassifyInput,
  context: ClassifyContext,
  merchant: MerchantRule | null,
  mcc: MccRule | null,
  model: { categoryKey: ClassifySignal["categoryKey"]; ledgerCode: number; confidence: number },
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
  signals.push({
    name: "naive_bayes",
    ledgerCode: model.ledgerCode,
    categoryKey: model.categoryKey,
    confidence: model.confidence >= 0.55 ? Math.min(0.82, model.confidence) : Math.min(0.38, model.confidence),
    detail: model.categoryKey,
  });
  if (txn.ocrMerchantName || txn.ocrText) {
    const ocrMerchant = matchMerchant(txn.ocrMerchantName, txn.ocrText ?? "", context.merchantRules);
    if (ocrMerchant) {
      signals.push({
        name: "ocr_merchant",
        ledgerCode: ledgerCodeFor(context.profile, ocrMerchant.categoryKey, ocrMerchant.ledgerCode),
        categoryKey: ocrMerchant.categoryKey,
        taxCodeKind: ocrMerchant.taxCodeKind,
        confidence: Math.min(0.9, ocrMerchant.confidence - 0.04),
        detail: ocrMerchant.merchantName,
      });
    }
  }
  if (txn.ocrInvoiceNumber && txn.type === "CREDIT") {
    signals.push({
      name: "ocr_invoice",
      ledgerCode: defaultIncomeCode(context.profile),
      categoryKey: "sales",
      taxCodeKind: TaxCodeKind.VAT_STANDARD,
      confidence: 0.74,
      detail: txn.ocrInvoiceNumber,
    });
  }

  const categoryText = `${txn.transactionCategory ?? ""} ${txn.category ?? ""} ${txn.labels?.join(" ") ?? ""} ${txn.ocrText ?? ""}`;
  const hint = CATEGORY_HINTS.find((rule) => rule.match.test(categoryText) || rule.match.test(txn.description) || rule.match.test(txn.ocrText ?? ""));
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

  const hasRuleSignal = signals.some((signal) => signal.name !== "naive_bayes");
  if (!hasRuleSignal) {
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
