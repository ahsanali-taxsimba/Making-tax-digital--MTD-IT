import {
  PrismaClient,
  ClientType,
  UserRole,
  ObligationStatus,
  ChartProfile,
  JournalSource,
  TaxCodeKind,
  PartyKind,
  DocumentStatus,
  BankTxnDirection,
  BankTxnStatus,
} from "@prisma/client";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { CHART_OF_ACCOUNTS, getChart, toChartProfile, toLedgerAccountType } from "../src/ledger/chart-of-accounts.catalog";
import { flattenItsaCatalog } from "../src/itsa/mtd-itsa.mapping";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("PracticeAdmin123!", 10);

  const firm = await prisma.firm.upsert({
    where: { id: "11111111-1111-4111-8111-111111111111" },
    update: {},
    create: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Northbridge Accountants LLP",
      address: "14 King Street, Manchester, M2 6AW",
      contactEmail: "carol.w@example.org",
      planType: "PRACTICE",
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

  await prisma.user.upsert({
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

  await prisma.user.upsert({
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
          status: BankTxnStatus.UNMATCHED,
        },
      ],
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

  // eslint-disable-next-line no-console
  console.log("Seeded Northbridge Accountants LLP");
  // eslint-disable-next-line no-console
  console.log("  Admin      marco.r@example.org / PracticeAdmin123!");
  // eslint-disable-next-line no-console
  console.log("  Accountant carol.w@example.org / PracticeAdmin123!");
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
