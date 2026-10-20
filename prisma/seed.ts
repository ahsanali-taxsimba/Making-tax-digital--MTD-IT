import {
  PrismaClient,
  ClientType,
  PlatformRole,
  UserRole,
  RiskLevel,
  ObligationStatus,
  ChartProfile,
  JournalSource,
  TaxCodeKind,
  PartyKind,
  DocumentStatus,
  EvidenceStatus,
  TaskType,
  TaskStatus,
  BankTxnDirection,
  BankTxnStatus,
} from "@prisma/client";
import { randomBytes } from "crypto";
import { PasswordHasher } from "../src/security/password-hasher";
import { MCC_MAPPING } from "../src/categorisation/domain/mcc.mapping";
import { MERCHANT_DICTIONARY } from "../src/categorisation/domain/merchant.dictionary";
import { flattenItsaCatalog } from "../src/itsa/mtd-itsa.mapping";
import { CHART_OF_ACCOUNTS, getChart, toChartProfile, toLedgerAccountType } from "../src/ledger/chart-of-accounts.catalog";
import { DEFAULT_BILLING_PLANS } from "../src/billing/billing.catalog";

const prisma = new PrismaClient();

async function main() {
  const hasher = new PasswordHasher();
  const passwordHash = await hasher.hash("PracticeAdmin123!");

  for (const plan of DEFAULT_BILLING_PLANS) {
    await prisma.billingPlan.upsert({
      where: { slug: plan.slug },
      update: { name: plan.name, description: plan.description, unitAmountPence: plan.unitAmountPence, enabled: true },
      create: {
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        audience: plan.audience,
        billingModel: plan.billingModel,
        unitAmountPence: plan.unitAmountPence,
        vatPercent: plan.vatPercent,
        minQuantity: plan.minQuantity,
        maxQuantity: plan.maxQuantity,
        features: plan.features,
        highlight: plan.highlight,
        sortOrder: plan.sortOrder,
        enabled: true,
      },
    });
  }

  const firm = await prisma.firm.upsert({
    where: { id: "11111111-1111-4111-8111-111111111111" },
    update: { slug: "northbridge", subscriptionPlan: "practice" },
    create: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Northbridge Accountants LLP",
      slug: "northbridge",
      address: "14 King Street, Manchester, M2 6AW",
      contactEmail: "carol.w@example.org",
      planType: "PRACTICE",
      subscriptionPlan: "practice",
      billingStatus: "ACTIVE",
      webhookSecret: randomBytes(32).toString("hex"),
    },
  });

  const soleTrader = await prisma.client.upsert({
    where: { id: "22222222-2222-4222-8222-222222222222" },
    update: {},
    create: {
      id: "22222222-2222-4222-8222-222222222222",
      firmId: firm.id,
      type: ClientType.INDIVIDUAL,
      name: "Amelia Hartley",
      utr: "1234567890",
      vatRegistrationNumber: "888888888",
      niNumber: "AA123456A",
      nino: "AA123456A",
      dateOfBirth: new Date("1986-04-12"),
    },
  });

  const landlord = await prisma.client.upsert({
    where: { id: "66666666-6666-4666-8666-666666666666" },
    update: {},
    create: {
      id: "66666666-6666-4666-8666-666666666666",
      firmId: firm.id,
      type: ClientType.LANDLORD,
      name: "Hartley Lets Portfolio",
      utr: "5566778899",
      nino: "CC123456C",
      niNumber: "CC123456C",
    },
  });

  const company = await prisma.client.upsert({
    where: { id: "33333333-3333-4333-8333-333333333333" },
    update: {},
    create: {
      id: "33333333-3333-4333-8333-333333333333",
      firmId: firm.id,
      type: ClientType.COMPANY,
      name: "Hartley Design Ltd",
      utr: "1098765432",
      vatRegistrationNumber: "999999999",
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: "marco.r@example.org" },
    update: { passwordHash },
    create: {
      name: "Priya Shah",
      email: "marco.r@example.org",
      role: UserRole.ADMIN,
      firmId: firm.id,
      passwordHash,
    },
  });

  const accountant = await prisma.user.upsert({
    where: { email: "carol.w@example.org" },
    update: { passwordHash },
    create: {
      name: "James Cole",
      email: "carol.w@example.org",
      role: UserRole.ACCOUNTANT,
      firmId: firm.id,
      passwordHash,
    },
  });

  const assistant = await prisma.user.upsert({
    where: { email: "wendy.h@example.net" },
    update: { passwordHash },
    create: {
      name: "Noah Adeyemi",
      email: "wendy.h@example.net",
      role: UserRole.ASSISTANT,
      firmId: firm.id,
      passwordHash,
    },
  });

  await prisma.client.update({
    where: { id: soleTrader.id },
    data: { assignedUserId: accountant.id, riskLevel: RiskLevel.MEDIUM },
  });
  await prisma.client.update({
    where: { id: landlord.id },
    data: { assignedUserId: accountant.id, riskLevel: RiskLevel.HIGH },
  });
  await prisma.client.update({
    where: { id: company.id },
    data: { assignedUserId: adminUser.id, riskLevel: RiskLevel.LOW },
  });

  await prisma.user.upsert({
    where: { email: "tom.h@example.org" },
    update: { passwordHash },
    create: {
      name: "Amelia Hartley",
      email: "tom.h@example.org",
      role: UserRole.CLIENT,
      firmId: firm.id,
      clientId: soleTrader.id,
      passwordHash,
    },
  });

  const platformPassword = await hasher.hash("PlatformAdmin123!");
  const platformRoles: Array<{ email: string; name: string; role: PlatformRole }> = [
    { email: "grace.l@example.com", name: "Samira Khan", role: PlatformRole.ADMIN_SUPER },
    { email: "ivan.p@example.net", name: "Owen Blake", role: PlatformRole.ADMIN_OWNER },
    { email: "ethan.b@example.com", name: "Lila Chen", role: PlatformRole.ADMIN_MARKETING },
    { email: "nathan.k@example.net", name: "Theo Brooks", role: PlatformRole.ADMIN_DEVELOPER },
    { email: "nina.v@example.com", name: "Ruth Adeyemi", role: PlatformRole.ADMIN_SUPPORT },
  ];
  for (const member of platformRoles) {
    await prisma.platformUser.upsert({
      where: { email: member.email },
      update: { passwordHash: platformPassword, isActive: true, role: member.role, name: member.name },
      create: { ...member, passwordHash: platformPassword, isActive: true },
    });
  }

  const westgate = await prisma.firm.upsert({
    where: { id: "aaaaaaa1-1111-4111-8111-111111111111" },
    update: { slug: "westgate", subscriptionPlan: "starter" },
    create: {
      id: "aaaaaaa1-1111-4111-8111-111111111111",
      name: "Westgate Tax Ltd",
      slug: "westgate",
      address: "2 Harbour Parade, Bristol, BS1 4AJ",
      contactEmail: "yuki.t@example.com",
      planType: "STARTER",
      subscriptionPlan: "starter",
      billingStatus: "TRIAL",
      webhookSecret: randomBytes(32).toString("hex"),
    },
  });
  await prisma.user.upsert({
    where: { email: "zoe.m@example.net" },
    update: { passwordHash, firmId: westgate.id },
    create: {
      name: "Helen Ward",
      email: "zoe.m@example.net",
      role: UserRole.ADMIN,
      firmId: westgate.id,
      passwordHash,
    },
  });

  for (const flag of [
    { key: "yapily_open_banking", enabled: true, description: "Yapily bank feeds" },
    { key: "invoice_extraction", enabled: true, description: "AI invoice extraction" },
    { key: "platform_marketing_console", enabled: false, description: "Marketing metrics console" },
  ]) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { enabled: flag.enabled, description: flag.description },
      create: flag,
    });
  }

  await prisma.business.upsert({
    where: { id: "44444444-4444-4444-8444-444444444444" },
    update: {},
    create: {
      id: "44444444-4444-4444-8444-444444444444",
      clientId: soleTrader.id,
      hmrcBusinessId: "XAIS12345678901",
      type: "self-employment",
      tradingName: "Hartley Studio",
      accountingType: "CASH",
    },
  });

  await prisma.business.upsert({
    where: { id: "55555555-5555-4555-8555-555555555555" },
    update: {},
    create: {
      id: "55555555-5555-4555-8555-555555555555",
      clientId: soleTrader.id,
      hmrcBusinessId: "XPTY12345678901",
      type: "uk-property",
      tradingName: "Hartley Lets",
      accountingType: "CASH",
    },
  });

  await prisma.vatObligation.upsert({
    where: { clientId_periodKey: { clientId: soleTrader.id, periodKey: "26A1" } },
    update: {},
    create: {
      clientId: soleTrader.id,
      periodKey: "26A1",
      start: new Date("2026-01-01"),
      end: new Date("2026-03-31"),
      due: new Date("2026-05-07"),
      status: ObligationStatus.OPEN,
    },
  });

  const existingItsa = await prisma.itsaObligation.count({ where: { clientId: soleTrader.id } });
  if (existingItsa === 0) {
    await prisma.itsaObligation.createMany({
      data: [
        {
          clientId: soleTrader.id,
          businessId: "44444444-4444-4444-8444-444444444444",
          type: "QUARTERLY_UPDATE",
          taxYear: "2025-26",
          periodId: "2026-04-06_2026-07-05",
          start: new Date("2026-04-06"),
          end: new Date("2026-07-05"),
          due: new Date("2026-08-07"),
          status: ObligationStatus.OPEN,
        },
        {
          clientId: soleTrader.id,
          businessId: "55555555-5555-4555-8555-555555555555",
          type: "QUARTERLY_UPDATE",
          taxYear: "2025-26",
          periodId: "2026-04-06_2026-07-05",
          start: new Date("2026-04-06"),
          end: new Date("2026-07-05"),
          due: new Date("2026-08-07"),
          status: ObligationStatus.OPEN,
        },
      ],
    });
  }

  const taxCodes = [
    { id: "77777777-7777-4777-8777-777777777701", code: "S", name: "Standard VAT 20%", rate: 20, type: TaxCodeKind.VAT_STANDARD },
    { id: "77777777-7777-4777-8777-777777777702", code: "R", name: "Reduced VAT 5%", rate: 5, type: TaxCodeKind.VAT_REDUCED },
    { id: "77777777-7777-4777-8777-777777777703", code: "Z", name: "Zero-rated VAT", rate: 0, type: TaxCodeKind.VAT_ZERO },
    { id: "77777777-7777-4777-8777-777777777704", code: "E", name: "VAT exempt", rate: 0, type: TaxCodeKind.VAT_EXEMPT },
    { id: "77777777-7777-4777-8777-777777777705", code: "NA", name: "No VAT", rate: 0, type: TaxCodeKind.NO_VAT },
  ];
  for (const tax of taxCodes) {
    await prisma.taxCode.upsert({
      where: { code: tax.code },
      update: { name: tax.name, rate: tax.rate, type: tax.type },
      create: tax,
    });
  }

  for (const chart of CHART_OF_ACCOUNTS) {
    const profile = toChartProfile(chart.profile);
    for (const account of chart.accounts) {
      await prisma.chartOfAccount.upsert({
        where: { profile_code: { profile, code: account.code } },
        update: { name: account.name, type: toLedgerAccountType(account.type), isActive: true },
        create: {
          profile,
          code: account.code,
          name: account.name,
          type: toLedgerAccountType(account.type),
          isActive: true,
        },
      });
    }
  }

  const templates = await prisma.chartOfAccount.findMany();
  const templateId = (profile: ChartProfile, code: number) =>
    templates.find((item) => item.profile === profile && item.code === code)?.id;

  const seedChart = async (clientId: string, profile: ChartProfile) => {
    const chart = getChart(profile);
    await prisma.ledger.createMany({
      data: chart.accounts.map((account) => ({
        clientId,
        profile,
        code: account.code,
        name: account.name,
        category: account.category,
        type: toLedgerAccountType(account.type),
        chartOfAccountId: templateId(profile, account.code),
        isActive: true,
      })),
      skipDuplicates: true,
    });
    const unlinked = await prisma.ledger.findMany({ where: { clientId, profile, chartOfAccountId: null } });
    for (const ledger of unlinked) {
      const chartId = templateId(profile, ledger.code);
      if (chartId) {
        await prisma.ledger.update({ where: { id: ledger.id }, data: { chartOfAccountId: chartId } });
      }
    }
  };

  await seedChart(soleTrader.id, ChartProfile.SOLE_TRADER);
  await seedChart(soleTrader.id, ChartProfile.LANDLORD);
  await seedChart(landlord.id, ChartProfile.LANDLORD);
  await seedChart(company.id, ChartProfile.COMPANY);

  for (const mapping of flattenItsaCatalog()) {
    await prisma.itsaAccountMapping.upsert({
      where: { profile_code: { profile: mapping.profile, code: mapping.code } },
      update: {
        bucket: mapping.bucket,
        category: mapping.category,
        hmrcKey: mapping.hmrcKey,
        includedInQuarterlyUpdate: mapping.includedInQuarterlyUpdate,
      },
      create: {
        profile: mapping.profile,
        code: mapping.code,
        bucket: mapping.bucket,
        category: mapping.category,
        hmrcKey: mapping.hmrcKey,
        includedInQuarterlyUpdate: mapping.includedInQuarterlyUpdate,
      },
    });
  }

  const admin = await prisma.user.findUnique({ where: { email: "marco.r@example.org" } });
  const ledger = async (clientId: string, profile: ChartProfile, code: number) => {
    const row = await prisma.ledger.findUnique({
      where: { clientId_profile_code: { clientId, profile, code } },
    });
    if (!row) {
      throw new Error(`Missing ledger ${profile} ${code}`);
    }
    return row;
  };

  const customer = await prisma.tradingParty.upsert({
    where: { id: "99999999-9999-4999-8999-999999999901" },
    update: {},
    create: {
      id: "99999999-9999-4999-8999-999999999901",
      clientId: soleTrader.id,
      kind: PartyKind.CUSTOMER,
      name: "Brighton Gallery Ltd",
    },
  });
  const supplier = await prisma.tradingParty.upsert({
    where: { id: "99999999-9999-4999-8999-999999999902" },
    update: {},
    create: {
      id: "99999999-9999-4999-8999-999999999902",
      clientId: soleTrader.id,
      kind: PartyKind.SUPPLIER,
      name: "North Ads Agency",
    },
  });

  const sales = await ledger(soleTrader.id, ChartProfile.SOLE_TRADER, 1000);
  const ads = await ledger(soleTrader.id, ChartProfile.SOLE_TRADER, 3000);
  const debtors = await ledger(soleTrader.id, ChartProfile.SOLE_TRADER, 1100);
  const creditors = await ledger(soleTrader.id, ChartProfile.SOLE_TRADER, 2100);
  const bank = await ledger(soleTrader.id, ChartProfile.SOLE_TRADER, 1200);
  const outputVat = await ledger(soleTrader.id, ChartProfile.SOLE_TRADER, 2200);
  const inputVat = await ledger(soleTrader.id, ChartProfile.SOLE_TRADER, 2220);
  const capital = await ledger(soleTrader.id, ChartProfile.SOLE_TRADER, 4000);
  const entertainment = await ledger(soleTrader.id, ChartProfile.SOLE_TRADER, 4300);
  const rent = await ledger(soleTrader.id, ChartProfile.LANDLORD, 2000);
  const agentFees = await ledger(soleTrader.id, ChartProfile.LANDLORD, 3030);
  const standardVat = "77777777-7777-4777-8777-777777777701";

  const seedJournal = async (input: {
    id: string;
    date: string;
    description: string;
    source: JournalSource;
    reference?: string;
    lines: Array<{ ledgerId: string; debit: number; credit: number; taxCodeId?: string; description?: string }>;
  }) => {
    const existing = await prisma.journalEntry.findUnique({ where: { id: input.id } });
    if (existing) {
      return existing;
    }
    const entry = await prisma.journalEntry.create({
      data: {
        id: input.id,
        firmId: firm.id,
        clientId: soleTrader.id,
        date: new Date(input.date),
        description: input.description,
        reference: input.reference,
        source: input.source,
        createdByUserId: admin?.id,
        lines: {
          create: input.lines.map((line) => ({
            ledgerAccountId: line.ledgerId,
            debit: line.debit,
            credit: line.credit,
            taxCodeId: line.taxCodeId,
            description: line.description,
          })),
        },
      },
    });
    for (const line of input.lines) {
      const account = [sales, ads, debtors, creditors, bank, outputVat, inputVat, capital, entertainment, rent, agentFees].find(
        (item) => item.id === line.ledgerId,
      );
      const debitNormal = [1100, 1200, 3000, 4000, 4300, 3030].includes(account?.code ?? 0);
      const delta = debitNormal ? line.debit - line.credit : line.credit - line.debit;
      await prisma.ledger.update({ where: { id: line.ledgerId }, data: { currentBalance: { increment: delta } } });
      await prisma.transaction.create({
        data: {
          clientId: soleTrader.id,
          ledgerId: line.ledgerId,
          date: new Date(input.date),
          description: line.description ?? input.description,
          amount: delta,
          source: input.source.toLowerCase(),
        },
      });
    }
    return entry;
  };

  const invoiceJournal = await seedJournal({
    id: "aaaaaaa1-0000-4000-8000-000000000001",
    date: "2026-01-15",
    description: "Sales invoice INV-1001 Brighton Gallery Ltd",
    source: JournalSource.INVOICE,
    reference: "INV-1001",
    lines: [
      { ledgerId: debtors.id, debit: 7200, credit: 0, description: "Trade debtors" },
      { ledgerId: sales.id, debit: 0, credit: 6000, taxCodeId: standardVat, description: "Studio sales" },
      { ledgerId: outputVat.id, debit: 0, credit: 1200, description: "Output VAT" },
    ],
  });
  const billJournal = await seedJournal({
    id: "aaaaaaa1-0000-4000-8000-000000000002",
    date: "2026-02-10",
    description: "Purchase bill BILL-88 North Ads Agency",
    source: JournalSource.BILL,
    reference: "BILL-88",
    lines: [
      { ledgerId: ads.id, debit: 1000, credit: 0, taxCodeId: standardVat, description: "Advertising" },
      { ledgerId: inputVat.id, debit: 200, credit: 0, description: "Input VAT" },
      { ledgerId: creditors.id, debit: 0, credit: 1200, description: "Trade creditors" },
    ],
  });
  await seedJournal({
    id: "aaaaaaa1-0000-4000-8000-000000000003",
    date: "2026-04-20",
    description: "Banked studio receipts",
    source: JournalSource.BANK_FEED,
    lines: [
      { ledgerId: bank.id, debit: 5000, credit: 0 },
      { ledgerId: sales.id, debit: 0, credit: 5000, taxCodeId: standardVat },
    ],
  });
  await seedJournal({
    id: "aaaaaaa1-0000-4000-8000-000000000004",
    date: "2026-05-12",
    description: "Advertising spend",
    source: JournalSource.BANK_FEED,
    lines: [
      { ledgerId: ads.id, debit: 250, credit: 0, taxCodeId: standardVat },
      { ledgerId: bank.id, debit: 0, credit: 250 },
    ],
  });
  await seedJournal({
    id: "aaaaaaa1-0000-4000-8000-000000000005",
    date: "2026-06-01",
    description: "Camera equipment (capital)",
    source: JournalSource.MANUAL,
    lines: [
      { ledgerId: capital.id, debit: 800, credit: 0 },
      { ledgerId: bank.id, debit: 0, credit: 800 },
    ],
  });
  await seedJournal({
    id: "aaaaaaa1-0000-4000-8000-000000000006",
    date: "2026-06-15",
    description: "Client entertainment (disallowable)",
    source: JournalSource.MANUAL,
    lines: [
      { ledgerId: entertainment.id, debit: 50, credit: 0 },
      { ledgerId: bank.id, debit: 0, credit: 50 },
    ],
  });
  await seedJournal({
    id: "aaaaaaa1-0000-4000-8000-000000000007",
    date: "2026-04-08",
    description: "Residential rent received",
    source: JournalSource.BANK_FEED,
    lines: [
      { ledgerId: bank.id, debit: 2000, credit: 0 },
      { ledgerId: rent.id, debit: 0, credit: 2000 },
    ],
  });
  await seedJournal({
    id: "aaaaaaa1-0000-4000-8000-000000000008",
    date: "2026-05-02",
    description: "Letting agent fees",
    source: JournalSource.BANK_FEED,
    lines: [
      { ledgerId: agentFees.id, debit: 150, credit: 0 },
      { ledgerId: bank.id, debit: 0, credit: 150 },
    ],
  });

  await prisma.salesInvoice.upsert({
    where: { id: "bbbbbbbb-0000-4000-8000-000000000001" },
    update: {},
    create: {
      id: "bbbbbbbb-0000-4000-8000-000000000001",
      clientId: soleTrader.id,
      customerId: customer.id,
      date: new Date("2026-01-15"),
      dueDate: new Date("2026-02-14"),
      status: DocumentStatus.POSTED,
      netTotal: 6000,
      vatTotal: 1200,
      grossTotal: 7200,
      journalId: invoiceJournal.id,
      lines: {
        create: [{ description: "Studio sales", net: 6000, vat: 1200, taxCodeId: standardVat, ledgerId: sales.id }],
      },
    },
  });
  await prisma.purchaseBill.upsert({
    where: { id: "bbbbbbbb-0000-4000-8000-000000000002" },
    update: {},
    create: {
      id: "bbbbbbbb-0000-4000-8000-000000000002",
      clientId: soleTrader.id,
      supplierId: supplier.id,
      date: new Date("2026-02-10"),
      dueDate: new Date("2026-03-10"),
      status: DocumentStatus.POSTED,
      netTotal: 1000,
      vatTotal: 200,
      grossTotal: 1200,
      journalId: billJournal.id,
      lines: {
        create: [{ description: "Advertising", net: 1000, vat: 200, taxCodeId: standardVat, ledgerId: ads.id }],
      },
    },
  });

  await prisma.bankAccount.upsert({
    where: { id: "88888888-8888-4888-8888-888888888888" },
    update: {},
    create: {
      id: "88888888-8888-4888-8888-888888888888",
      firmId: firm.id,
      clientId: soleTrader.id,
      name: "Hartley Studio current account",
      sortCode: "20-45-67",
      accountNumber: "12345678",
      provider: "starling",
      ledgerId: bank.id,
    },
  });
  if ((await prisma.bankTransaction.count({ where: { bankAccountId: "88888888-8888-4888-8888-888888888888" } })) === 0) {
    await prisma.bankTransaction.createMany({
      data: [
        {
          bankAccountId: "88888888-8888-4888-8888-888888888888",
          date: new Date("2026-04-20"),
          amount: 5000,
          type: BankTxnDirection.CREDIT,
          description: "Banked studio receipts",
          externalRef: "STAR-5000",
          matchedJournalEntryId: "aaaaaaa1-0000-4000-8000-000000000003",
          status: BankTxnStatus.MATCHED,
        },
        {
          bankAccountId: "88888888-8888-4888-8888-888888888888",
          date: new Date("2026-03-18"),
          amount: 40,
          type: BankTxnDirection.DEBIT,
          description: "Unmatched bank fee",
          externalRef: "STAR-40",
          merchantName: "Starling",
          category: "bank_charges",
          status: BankTxnStatus.UNMATCHED,
        },
      ],
    });
  }

  const enrichedTxns = [
    {
      id: "88888888-8888-4888-8888-888888888801",
      date: new Date("2026-03-04"),
      amount: 55,
      type: BankTxnDirection.DEBIT,
      description: "BP CONNECT BRIGHTON",
      externalRef: "STAR-BP-55",
      merchantName: "BP",
      category: "fuel",
      merchantCategoryCode: "5541",
      transactionCategory: "fuel",
      location: "Brighton, GB",
      labels: ["motor"],
      enrichment: { merchantName: "BP", merchantCategoryCode: "5541" },
    },
    {
      id: "88888888-8888-4888-8888-888888888802",
      date: new Date("2026-03-06"),
      amount: 23.4,
      type: BankTxnDirection.DEBIT,
      description: "TESCO STORES 2847",
      externalRef: "STAR-TESCO-2340",
      merchantName: "Tesco",
      category: "groceries",
      merchantCategoryCode: "5411",
      transactionCategory: "groceries",
      location: "Brighton, GB",
      labels: ["supermarket"],
      enrichment: { merchantName: "Tesco", merchantCategoryCode: "5411" },
    },
    {
      id: "88888888-8888-4888-8888-888888888803",
      date: new Date("2026-03-08"),
      amount: 48,
      type: BankTxnDirection.DEBIT,
      description: "THE LANE RESTAURANT",
      externalRef: "STAR-LANE-48",
      merchantName: "The Lane Restaurant",
      category: "restaurants",
      merchantCategoryCode: "5812",
      transactionCategory: "restaurants",
      location: "Brighton, GB",
      labels: ["dining"],
      enrichment: { merchantName: "The Lane Restaurant", merchantCategoryCode: "5812" },
    },
    {
      id: "88888888-8888-4888-8888-888888888804",
      date: new Date("2026-03-01"),
      amount: 12.99,
      type: BankTxnDirection.DEBIT,
      description: "ADOBE CREATIVE CLOUD MONTHLY",
      externalRef: "STAR-ADOBE-1299",
      merchantName: "Adobe",
      category: "subscriptions",
      merchantCategoryCode: "5817",
      transactionCategory: "subscriptions",
      labels: ["saas"],
      enrichment: { merchantName: "Adobe", merchantCategoryCode: "5817" },
    },
  ];
  for (const row of enrichedTxns) {
    await prisma.bankTransaction.upsert({
      where: { id: row.id },
      update: {
        merchantName: row.merchantName,
        category: row.category,
        merchantCategoryCode: row.merchantCategoryCode,
        transactionCategory: row.transactionCategory,
        location: row.location,
        labels: row.labels,
        enrichment: row.enrichment,
      },
      create: {
        ...row,
        bankAccountId: "88888888-8888-4888-8888-888888888888",
        status: BankTxnStatus.UNMATCHED,
      },
    });
  }

  const matchingTxns = [
    {
      id: "88888888-8888-4888-8888-888888888811",
      date: new Date("2026-01-16"),
      amount: 7200,
      type: BankTxnDirection.CREDIT,
      description: "Brighton Gallery Ltd INV-1001",
      externalRef: "MATCH-INV-1001",
      merchantName: "Brighton Gallery Ltd",
      merchantCategoryCode: "4829",
      transactionCategory: "transfer",
      labels: ["invoice"],
      enrichment: { merchantName: "Brighton Gallery Ltd", merchantCategoryCode: "4829" },
    },
    {
      id: "88888888-8888-4888-8888-888888888812",
      date: new Date("2026-02-10"),
      amount: 1200,
      type: BankTxnDirection.DEBIT,
      description: "North Ads Agency BILL-88",
      externalRef: "MATCH-BILL-88",
      merchantName: "North Ads Agency",
      merchantCategoryCode: "7311",
      transactionCategory: "advertising",
      labels: ["bill"],
      enrichment: { merchantName: "North Ads Agency", merchantCategoryCode: "7311" },
    },
  ];
  for (const row of matchingTxns) {
    await prisma.bankTransaction.upsert({
      where: { id: row.id },
      update: {
        merchantName: row.merchantName,
        merchantCategoryCode: row.merchantCategoryCode,
        transactionCategory: row.transactionCategory,
        labels: row.labels,
        enrichment: row.enrichment,
        description: row.description,
        amount: row.amount,
        type: row.type,
        date: row.date,
      },
      create: {
        ...row,
        bankAccountId: "88888888-8888-4888-8888-888888888888",
        status: BankTxnStatus.UNMATCHED,
      },
    });
  }

  for (const rule of MERCHANT_DICTIONARY) {
    await prisma.categorisationMerchantRule.upsert({
      where: { merchantKey: rule.merchantKey },
      update: {
        merchantName: rule.merchantName,
        aliases: rule.aliases,
        categoryKey: rule.categoryKey,
        ledgerCode: rule.ledgerCode,
        taxCodeKind: rule.taxCodeKind,
        itsaCategory: rule.itsaCategory,
        confidence: rule.confidence,
      },
      create: {
        merchantKey: rule.merchantKey,
        merchantName: rule.merchantName,
        aliases: rule.aliases,
        categoryKey: rule.categoryKey,
        ledgerCode: rule.ledgerCode,
        taxCodeKind: rule.taxCodeKind,
        itsaCategory: rule.itsaCategory,
        confidence: rule.confidence,
      },
    });
  }
  for (const rule of MCC_MAPPING) {
    await prisma.categorisationMccRule.upsert({
      where: { mcc: rule.mcc },
      update: {
        industry: rule.industry,
        categoryKey: rule.categoryKey,
        ledgerCode: rule.ledgerCode,
        taxCodeKind: rule.taxCodeKind,
        vatable: rule.vatable,
        itsaCategory: rule.itsaCategory,
        confidence: rule.confidence,
      },
      create: {
        mcc: rule.mcc,
        industry: rule.industry,
        categoryKey: rule.categoryKey,
        ledgerCode: rule.ledgerCode,
        taxCodeKind: rule.taxCodeKind,
        vatable: rule.vatable,
        itsaCategory: rule.itsaCategory,
        confidence: rule.confidence,
      },
    });
  }

  await prisma.accountingPeriod.upsert({
    where: {
      clientId_start_end: {
        clientId: soleTrader.id,
        start: new Date("2026-01-01"),
        end: new Date("2026-03-31"),
      },
    },
    update: {},
    create: {
      firmId: firm.id,
      clientId: soleTrader.id,
      start: new Date("2026-01-01"),
      end: new Date("2026-03-31"),
      locked: false,
    },
  });
  await prisma.accountingPeriod.upsert({
    where: {
      clientId_start_end: {
        clientId: soleTrader.id,
        start: new Date("2024-04-06"),
        end: new Date("2025-04-05"),
      },
    },
    update: { locked: true },
    create: {
      firmId: firm.id,
      clientId: soleTrader.id,
      start: new Date("2024-04-06"),
      end: new Date("2025-04-05"),
      locked: true,
    },
  });

  await prisma.supportingDocument.upsert({
    where: { id: "66666666-6666-4666-8666-666666666661" },
    update: {},
    create: {
      id: "66666666-6666-4666-8666-666666666661",
      clientId: soleTrader.id,
      fileName: "q1-bank-statement.pdf",
      mimeType: "application/pdf",
      sizeBytes: 184320,
      storageKey: `pending/${soleTrader.id}/q1-bank-statement.pdf`,
      category: "bank_statement",
      status: EvidenceStatus.PENDING,
      uploadedBy: "tom.h@example.org",
    },
  });
  await prisma.supportingDocument.upsert({
    where: { id: "66666666-6666-4666-8666-666666666662" },
    update: {},
    create: {
      id: "66666666-6666-4666-8666-666666666662",
      clientId: soleTrader.id,
      fileName: "studio-invoice-104.pdf",
      mimeType: "application/pdf",
      sizeBytes: 62480,
      storageKey: `used/${soleTrader.id}/studio-invoice-104.pdf`,
      category: "invoice",
      status: EvidenceStatus.USED,
      uploadedBy: "tom.h@example.org",
    },
  });

  await prisma.task.upsert({
    where: { id: "77777777-7777-4777-8777-777777777761" },
    update: { assigneeId: assistant.id, status: TaskStatus.WAITING_ON_CLIENT },
    create: {
      id: "77777777-7777-4777-8777-777777777761",
      firmId: firm.id,
      clientId: soleTrader.id,
      assigneeId: assistant.id,
      type: TaskType.PROVIDE_RECORDS,
      status: TaskStatus.WAITING_ON_CLIENT,
      dueDate: new Date("2026-04-20"),
      title: "Provide Q1 records",
    },
  });
  await prisma.task.upsert({
    where: { id: "77777777-7777-4777-8777-777777777762" },
    update: { assigneeId: accountant.id },
    create: {
      id: "77777777-7777-4777-8777-777777777762",
      firmId: firm.id,
      clientId: soleTrader.id,
      assigneeId: accountant.id,
      type: TaskType.APPROVE_RETURN,
      status: TaskStatus.OPEN,
      dueDate: new Date("2026-05-07"),
      title: "Approve draft VAT return 26A1",
    },
  });
  await prisma.task.upsert({
    where: { id: "77777777-7777-4777-8777-777777777763" },
    update: {},
    create: {
      id: "77777777-7777-4777-8777-777777777763",
      firmId: firm.id,
      clientId: soleTrader.id,
      assigneeId: accountant.id,
      type: TaskType.VAT_RETURN,
      status: TaskStatus.IN_PROGRESS,
      dueDate: new Date("2026-05-07"),
      title: "Prepare VAT return 26A1",
    },
  });
  await prisma.task.upsert({
    where: { id: "77777777-7777-4777-8777-777777777764" },
    update: {},
    create: {
      id: "77777777-7777-4777-8777-777777777764",
      firmId: firm.id,
      clientId: soleTrader.id,
      assigneeId: accountant.id,
      type: TaskType.ITSA_UPDATE,
      status: TaskStatus.OPEN,
      dueDate: new Date("2026-08-07"),
      title: "ITSA quarterly update Q1 2025-26",
    },
  });
  await prisma.task.upsert({
    where: { id: "77777777-7777-4777-8777-777777777765" },
    update: {},
    create: {
      id: "77777777-7777-4777-8777-777777777765",
      firmId: firm.id,
      clientId: landlord.id,
      assigneeId: assistant.id,
      type: TaskType.BOOKKEEPING,
      status: TaskStatus.IN_PROGRESS,
      dueDate: new Date("2026-04-30"),
      title: "Post April letting invoices",
    },
  });
  await prisma.task.upsert({
    where: { id: "77777777-7777-4777-8777-777777777766" },
    update: {},
    create: {
      id: "77777777-7777-4777-8777-777777777766",
      firmId: firm.id,
      clientId: company.id,
      assigneeId: adminUser.id,
      type: TaskType.RECONCILIATION,
      status: TaskStatus.COMPLETED,
      dueDate: new Date("2026-03-31"),
      completedAt: new Date("2026-03-28"),
      title: "Reconcile March current account",
    },
  });
  await prisma.task.upsert({
    where: { id: "77777777-7777-4777-8777-777777777767" },
    update: {},
    create: {
      id: "77777777-7777-4777-8777-777777777767",
      firmId: firm.id,
      clientId: company.id,
      assigneeId: accountant.id,
      type: TaskType.EOPS,
      status: TaskStatus.OPEN,
      dueDate: new Date("2026-05-31"),
      title: "Draft company EOPS pack",
    },
  });
  await prisma.task.upsert({
    where: { id: "77777777-7777-4777-8777-777777777768" },
    update: {},
    create: {
      id: "77777777-7777-4777-8777-777777777768",
      firmId: firm.id,
      clientId: soleTrader.id,
      type: TaskType.FINAL_DECLARATION,
      status: TaskStatus.OPEN,
      dueDate: new Date("2027-01-31"),
      title: "Final declaration 2025-26",
    },
  });

  const existingThread = await prisma.clientMessage.count({ where: { clientId: soleTrader.id } });
  if (existingThread === 0) {
    await prisma.clientMessage.createMany({
      data: [
        {
          clientId: soleTrader.id,
          authorId: "11111111-1111-4111-8111-111111111101",
          authorRole: UserRole.ACCOUNTANT,
          authorName: "Priya Shah",
          body: "Hi Amelia — please upload your Q1 bank statement and confirm the draft VAT return when you have a moment.",
          createdAt: new Date("2026-04-08T09:15:00Z"),
        },
        {
          clientId: soleTrader.id,
          authorId: "22222222-2222-4222-8222-222222222201",
          authorRole: UserRole.CLIENT,
          authorName: "Amelia Hartley",
          body: "Thanks Priya. I will upload the statement this week and review the VAT boxes.",
          createdAt: new Date("2026-04-08T11:40:00Z"),
        },
      ],
    });
  }

  // eslint-disable-next-line no-console
  console.log("Seeded Northbridge Accountants LLP");
  // eslint-disable-next-line no-console
  console.log("  Admin      marco.r@example.org / PracticeAdmin123!");
  // eslint-disable-next-line no-console
  console.log("  Accountant carol.w@example.org / PracticeAdmin123!");
  // eslint-disable-next-line no-console
  console.log("  Assistant  wendy.h@example.net / PracticeAdmin123!");
  // eslint-disable-next-line no-console
  console.log("  Client     tom.h@example.org / PracticeAdmin123!");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
