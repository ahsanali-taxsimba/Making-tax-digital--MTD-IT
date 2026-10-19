import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { UserRole, UserStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { HMRC_ITSA, HMRC_OAUTH, HMRC_VAT } from "../src/hmrc/hmrc.tokens";

describe("MTD API (e2e)", () => {
  let app: INestApplication;
  const passwordHash = bcrypt.hashSync("PracticeAdmin123!", 4);
  const users = [
    {
      id: "user-admin",
      name: "Priya",
      email: "marco.r@example.org",
      role: UserRole.ADMIN,
      firmId: "firm-1",
      clientId: null,
      status: UserStatus.ACTIVE,
      passwordHash,
    },
  ];
  const clients = [
    {
      id: "22222222-2222-4222-8222-222222222222",
      firmId: "firm-1",
      name: "Amelia Hartley",
      type: "INDIVIDUAL",
      vatRegistrationNumber: "888888888",
      nino: "AA123456A",
      niNumber: "AA123456A",
      businesses: [],
    },
  ];
  const refreshTokens: Array<{ tokenHash: string; user: (typeof users)[0]; revokedAt: Date | null; expiresAt: Date }> = [];

  const prisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; email?: string } }) =>
        users.find((user) => user.id === where.id || user.email === where.email) ?? null,
      ),
      findMany: jest.fn(async () => users),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(async ({ data }: { data: { tokenHash: string; expiresAt: Date; userId: string } }) => {
        const user = users.find((item) => item.id === data.userId)!;
        refreshTokens.push({ ...data, user, revokedAt: null });
        return data;
      }),
      findUnique: jest.fn(async ({ where }: { where: { tokenHash: string } }) =>
        refreshTokens.find((item) => item.tokenHash === where.tokenHash) ?? null,
      ),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    firm: { findUnique: jest.fn(async () => ({ id: "firm-1", name: "Northbridge", webhookSecret: "secret" })) },
    client: {
      findMany: jest.fn(async () => clients),
      findFirst: jest.fn(async ({ where }: { where: { id: string } }) => clients.find((item) => item.id === where.id) ?? null),
      create: jest.fn(async ({ data }: { data: { name: string; type?: string } }) => ({
        id: "new-client",
        firmId: "firm-1",
        type: data.type ?? "INDIVIDUAL",
        ...data,
      })),
    },
    ledger: { createMany: jest.fn().mockResolvedValue({ count: 26 }), findMany: jest.fn().mockResolvedValue([]) },
    oauthState: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    mtdConnection: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    webhookEvent: { create: jest.fn(), update: jest.fn() },
    webhookEndpoint: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { create: jest.fn() },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(HMRC_OAUTH)
      .useValue({
        buildAuthorizeUrl: () => "https://mock-hmrc.local/oauth/authorize?state=test",
        exchangeCode: async () => ({
          accessToken: "access",
          refreshToken: "refresh",
          expiresIn: 14400,
          scope: "read:vat",
        }),
        refresh: async () => ({ accessToken: "access", refreshToken: "refresh", expiresIn: 14400 }),
      })
      .overrideProvider(HMRC_VAT)
      .useValue({
        getObligations: async () => ({ data: { obligations: [] }, correlationId: "c", status: 200 }),
        submitReturn: async () => ({ data: { processingDate: new Date().toISOString() }, correlationId: "c", status: 200 }),
        getPayments: async () => ({ data: { payments: [] }, correlationId: "c", status: 200 }),
        getReturn: async () => ({ data: {}, correlationId: "c", status: 200 }),
      })
      .overrideProvider(HMRC_ITSA)
      .useValue({
        getObligations: async () => ({ data: { obligations: [] }, correlationId: "c", status: 200 }),
        submitQuarterlyUpdate: async () => ({ data: { periodId: "p1" }, correlationId: "c", status: 200 }),
        submitEops: async () => ({ data: { processingDate: new Date().toISOString() }, correlationId: "c", status: 200 }),
        submitFinalDeclaration: async () => ({ data: { calculationId: "calc" }, correlationId: "c", status: 200 }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("logs in, reads the firm, lists clients, and starts HMRC auth", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "marco.r@example.org", password: "PracticeAdmin123!" })
      .expect(200);

    expect(login.body.data.accessToken).toBeDefined();
    const token = login.body.data.accessToken as string;

    const firm = await request(app.getHttpServer()).get("/firms/me").set("Authorization", `Bearer ${token}`).expect(200);
    expect(firm.body.data.name).toBe("Northbridge");

    const created = await request(app.getHttpServer())
      .post("/clients")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "INDIVIDUAL", name: "Samira Khan", nino: "BB123456B", vatRegistrationNumber: "777777777" })
      .expect(201);
    expect(created.body.data.name).toBe("Samira Khan");

    const start = await request(app.getHttpServer())
      .post("/clients/22222222-2222-4222-8222-222222222222/mtd/start-auth")
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    expect(start.body.data.redirectUrl).toContain("oauth/authorize");
  });

  it("rejects invalid login payloads", async () => {
    await request(app.getHttpServer()).post("/auth/login").send({ email: "not-an-email" }).expect(400);
  });
});
