import { ChartProfile } from "@prisma/client";
import { ledgerCodeFor } from "./category-ledger";
import { MCC_MAPPING, normalizeMcc } from "./mcc.mapping";
import { MERCHANT_DICTIONARY } from "./merchant.dictionary";
import { CategorisationModel, CategoryKey, ClassifyInput, ModelPrediction } from "./types";

const STOP_WORDS = new Set(["the", "and", "for", "with", "from", "ltd", "limited", "plc", "of", "to", "on", "at", "in"]);

const CATEGORY_KEYS: CategoryKey[] = [
  "fuel",
  "groceries",
  "restaurants",
  "advertising",
  "bank_charges",
  "sales",
  "subscriptions",
  "travel",
  "insurance",
  "professional",
  "telecom",
  "software",
  "office",
  "rent",
  "utilities",
  "entertainment",
  "wages",
];

const PHRASE_SEEDS: Array<{ categoryKey: CategoryKey; description: string }> = [
  { categoryKey: "fuel", description: "petrol diesel unleaded pump station" },
  { categoryKey: "groceries", description: "supermarket groceries milk bread office snacks" },
  { categoryKey: "restaurants", description: "restaurant cafe dining lunch meal hospitality" },
  { categoryKey: "advertising", description: "advertising marketing campaign google ads facebook ads" },
  { categoryKey: "bank_charges", description: "bank fee interest charge atm withdrawal" },
  { categoryKey: "sales", description: "client invoice gallery turnover sales receipt" },
  { categoryKey: "subscriptions", description: "monthly subscription saas creative cloud software licence" },
  { categoryKey: "travel", description: "uber train hotel taxi rail ticket" },
  { categoryKey: "insurance", description: "insurance premium policy cover" },
  { categoryKey: "professional", description: "accountant solicitor consultant professional fees" },
  { categoryKey: "telecom", description: "mobile broadband telephone internet" },
  { categoryKey: "software", description: "software licence application development" },
  { categoryKey: "office", description: "stationery paper printer office supplies" },
  { categoryKey: "rent", description: "rent landlord premises lease" },
  { categoryKey: "utilities", description: "electricity gas water utility" },
  { categoryKey: "entertainment", description: "client entertainment hospitality event" },
  { categoryKey: "wages", description: "payroll salary wages staff" },
];

export interface TrainingExample {
  categoryKey: CategoryKey;
  merchantName?: string | null;
  description?: string | null;
  ocrText?: string | null;
  amount?: number | null;
  type?: ClassifyInput["type"] | null;
  merchantCategoryCode?: string | null;
}

export function amountBucket(amount: number | null | undefined): string | null {
  if (amount == null || Number.isNaN(amount)) {
    return null;
  }
  const abs = Math.abs(amount);
  if (abs < 15) {
    return "amt:micro";
  }
  if (abs < 50) {
    return "amt:small";
  }
  if (abs < 150) {
    return "amt:medium";
  }
  if (abs < 1000) {
    return "amt:large";
  }
  return "amt:xlarge";
}

export function tokenizeFeatures(input: {
  merchantName?: string | null;
  description?: string | null;
  ocrText?: string | null;
  amount?: number | null;
  type?: string | null;
  merchantCategoryCode?: string | null;
}): string[] {
  const text = [input.merchantName, input.description, input.ocrText].filter(Boolean).join(" ");
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
  const tokens = [...words];
  for (let index = 0; index < words.length - 1; index += 1) {
    tokens.push(`${words[index]}_${words[index + 1]}`);
  }
  const mcc = normalizeMcc(input.merchantCategoryCode);
  if (mcc) {
    tokens.push(`mcc:${mcc}`);
  }
  if (input.type) {
    tokens.push(`dir:${input.type.toLowerCase()}`);
  }
  const bucket = amountBucket(input.amount);
  if (bucket) {
    tokens.push(bucket);
  }
  return tokens;
}

export function seedTrainingExamples(
  merchants = MERCHANT_DICTIONARY,
  mccs = MCC_MAPPING,
): TrainingExample[] {
  const examples: TrainingExample[] = [];
  for (const merchant of merchants) {
    examples.push({
      categoryKey: merchant.categoryKey,
      merchantName: merchant.merchantName,
      description: [merchant.merchantName, ...merchant.aliases].join(" "),
    });
    for (const alias of merchant.aliases) {
      examples.push({ categoryKey: merchant.categoryKey, merchantName: alias, description: alias });
    }
  }
  for (const mcc of mccs) {
    examples.push({
      categoryKey: mcc.categoryKey,
      description: mcc.industry,
      merchantCategoryCode: mcc.mcc,
    });
  }
  examples.push(...PHRASE_SEEDS);
  return examples;
}

export class NaiveBayesClassifier implements CategorisationModel {
  private readonly vocabulary = new Set<string>();
  private readonly classCounts = new Map<CategoryKey, number>();
  private readonly tokenCounts = new Map<CategoryKey, Map<string, number>>();
  private readonly classTokenTotals = new Map<CategoryKey, number>();
  private trainedExamples = 0;

  train(examples: TrainingExample[]): this {
    for (const example of examples) {
      const tokens = tokenizeFeatures(example);
      this.trainedExamples += 1;
      this.classCounts.set(example.categoryKey, (this.classCounts.get(example.categoryKey) ?? 0) + 1);
      let tokenMap = this.tokenCounts.get(example.categoryKey);
      if (!tokenMap) {
        tokenMap = new Map();
        this.tokenCounts.set(example.categoryKey, tokenMap);
      }
      for (const token of tokens) {
        this.vocabulary.add(token);
        tokenMap.set(token, (tokenMap.get(token) ?? 0) + 1);
        this.classTokenTotals.set(example.categoryKey, (this.classTokenTotals.get(example.categoryKey) ?? 0) + 1);
      }
    }
    return this;
  }

  predict(input: ClassifyInput, profile: ChartProfile): ModelPrediction {
    const tokens = tokenizeFeatures(input);
    const vocab = Math.max(1, this.vocabulary.size);
    const totalDocs = Math.max(1, this.trainedExamples);
    const logScores = new Map<CategoryKey, number>();
    for (const category of CATEGORY_KEYS) {
      const docs = this.classCounts.get(category) ?? 0;
      if (docs === 0) {
        continue;
      }
      const tokenTotal = this.classTokenTotals.get(category) ?? 0;
      const counts = this.tokenCounts.get(category) ?? new Map();
      let score = Math.log((docs + 1) / (totalDocs + CATEGORY_KEYS.length));
      for (const token of tokens) {
        score += Math.log(((counts.get(token) ?? 0) + 1) / (tokenTotal + vocab));
      }
      logScores.set(category, score);
    }
    const entries = [...logScores.entries()];
    if (entries.length === 0) {
      return { categoryKey: input.type === "CREDIT" ? "sales" : "advertising", ledgerCode: input.type === "CREDIT" ? 1000 : 3000, confidence: 0.2 };
    }
    const max = Math.max(...entries.map(([, score]) => score));
    const exp = entries.map(([category, score]) => [category, Math.exp(score - max)] as const);
    const sum = exp.reduce((total, [, value]) => total + value, 0);
    const ranked = exp
      .map(([category, value]) => [category, value / sum] as const)
      .sort((left, right) => right[1] - left[1]);
    const [categoryKey, posterior] = ranked[0];
    return {
      categoryKey,
      ledgerCode: ledgerCodeFor(profile, categoryKey),
      confidence: Number(Math.min(0.94, Math.max(0.12, posterior)).toFixed(4)),
    };
  }

  stats() {
    return {
      algorithm: "naive_bayes",
      classes: CATEGORY_KEYS.filter((category) => (this.classCounts.get(category) ?? 0) > 0),
      vocabularySize: this.vocabulary.size,
      trainedExamples: this.trainedExamples,
    };
  }
}

let cached: NaiveBayesClassifier | null = null;

export function trainCategorisationModel(
  examples: TrainingExample[] = seedTrainingExamples(),
): NaiveBayesClassifier {
  return new NaiveBayesClassifier().train(examples);
}

export function defaultCategorisationModel(): NaiveBayesClassifier {
  if (!cached) {
    cached = trainCategorisationModel();
  }
  return cached;
}
