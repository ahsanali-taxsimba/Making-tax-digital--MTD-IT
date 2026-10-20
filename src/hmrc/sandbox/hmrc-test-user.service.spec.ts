import { HmrcTestUserKind } from "@prisma/client";
import { HmrcTestUserService } from "./hmrc-test-user.service";

describe("HmrcTestUserService", () => {
  const prisma = {
    hmrcSandboxTestUser: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const crypto = {
    encrypt: jest.fn((value: string) => `enc:${value}`),
    decrypt: jest.fn((value: string) => value.replace("enc:", "")),
  };
  const apps = {
    callsHmrc: jest.fn().mockReturnValue(false),
    testUsersFile: jest.fn().mockReturnValue(""),
    sandboxAuthBase: jest.fn().mockReturnValue("https://test-www.tax.service.gov.uk"),
    sandboxApiBase: jest.fn().mockReturnValue("https://test-api.service.hmrc.gov.uk"),
  };
  const audit = { record: jest.fn() };
  const oauth = {
    startAuth: jest.fn().mockResolvedValue({
      authorizationUrl: "https://test-api.service.hmrc.gov.uk/oauth/authorize?state=abc",
    }),
  };
  const service = new HmrcTestUserService(prisma as never, crypto as never, apps as never, audit as never, oauth as never);
  const user = { id: "u1", firmId: "firm-1" } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    apps.callsHmrc.mockReturnValue(false);
  });

  it("creates a mock VAT organisation test user without calling HMRC", async () => {
    prisma.hmrcSandboxTestUser.create.mockImplementation(async ({ data }) => ({
      ...data,
      id: "tu-1",
      createdAt: new Date(),
    }));
    const created = await service.create(user, { type: "organisation" });
    expect(created.userId).toBe("sandbox-org-user");
    expect(created.password).toBe("SandboxOrgPass1!");
    expect(created.vrn).toBe("888888888");
    expect(crypto.encrypt).toHaveBeenCalledWith("SandboxOrgPass1!");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "hmrc.sandbox.test_user.created", metadata: expect.objectContaining({ sandbox: true }) }),
    );
  });

  it("returns a login hint with the sandbox grant URL", async () => {
    prisma.hmrcSandboxTestUser.findFirst.mockResolvedValue({
      id: "tu-1",
      kind: HmrcTestUserKind.INDIVIDUAL,
      hmrcUserId: "sandbox-ind-user",
      passwordEnc: "enc:SandboxIndPass1!",
      vrn: null,
      nino: "AA123456A",
      saUtr: null,
      mtdItId: "XMIT1",
      ctUtr: null,
      eoriNumber: null,
      services: ["mtd-income-tax"],
      clientId: null,
      createdAt: new Date(),
    });
    const hint = await service.loginHint(user, "tu-1", "client-1");
    expect(hint.password).toBe("SandboxIndPass1!");
    expect(hint.authorizationUrl).toContain("/oauth/authorize");
    expect(hint.tokenUrl).toBe("https://test-api.service.hmrc.gov.uk/oauth/token");
    expect(oauth.startAuth).toHaveBeenCalledWith(user, "client-1", "sandbox");
  });
});
