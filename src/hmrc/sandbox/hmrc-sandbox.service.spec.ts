import { HmrcEnvironment } from "@prisma/client";
import { HmrcSandboxService } from "./hmrc-sandbox.service";
import { HMRC_SANDBOX_API_BASE, HMRC_SANDBOX_TOKEN } from "./hmrc-sandbox.urls";

describe("HmrcSandboxService", () => {
  const apps = {
    mode: jest.fn().mockReturnValue("sandbox"),
    defaultEnvironment: jest.fn().mockReturnValue(HmrcEnvironment.SANDBOX),
    sandboxFlag: jest.fn().mockReturnValue(true),
    callsHmrc: jest.fn().mockReturnValue(true),
    settings: jest.fn().mockReturnValue({
      clientId: "abcd1234",
      redirectUri: "http://localhost:2327/hmrc/callback",
      baseUrl: HMRC_SANDBOX_API_BASE,
      authBaseUrl: "https://test-www.tax.service.gov.uk",
      authorizeUrl: `${HMRC_SANDBOX_API_BASE}/oauth/authorize`,
    }),
  };
  const service = new HmrcSandboxService(apps as never);

  it("exposes the sandbox flag, token URL, and VAT/ITSA catalog", () => {
    const status = service.status();
    expect(status.mode).toBe("sandbox");
    expect(status.sandbox).toBe(true);
    expect(status.gateway.header).toBe("x-mtd-hmrc-sandbox");
    expect(status.urls.sandbox.token).toBe(HMRC_SANDBOX_TOKEN);
    expect(status.urls.sandbox.vatObligations).toContain("/organisations/vat/{vrn}/obligations");
    expect(status.urls.sandbox.quarterlyUpdates).toContain("/uk-property/periodic");
    expect(status.urls.sandbox.finalDeclaration).toContain("/calculations/final-declaration");
    expect(status.app.sandbox.configured).toBe(true);
  });
});
