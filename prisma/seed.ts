import { PrismaClient, ClientType, UserRole, ObligationStatus, LedgerAccountType } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";

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

  await prisma.ledger.createMany({
    data: [
      { clientId: soleTrader.id, name: "Self-employment income", type: LedgerAccountType.INCOME },
      { clientId: soleTrader.id, name: "Allowable expenses", type: LedgerAccountType.EXPENSE },
      { clientId: company.id, name: "Sales", type: LedgerAccountType.INCOME },
    ],
    skipDuplicates: true,
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
