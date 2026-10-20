import { HmrcEnvironment } from "@prisma/client";
import { HMRC_OAUTH_ERR, HmrcOAuthError } from "../oauth/hmrc-oauth.errors";
import { HMRC_ERR, HmrcClientError } from "./hmrc-client.errors";
import { runHmrcScope } from "../sandbox/hmrc-request-context";
import { HmrcClientService } from "./hmrc-client.service";

describe("HmrcClientService", () => {
  const oauth = { getValidAccessToken: jest.fn() };
  const http = { send: jest.fn() };
  const apps = {
    isLiveMode: jest.fn().mockReturnValue(false),
    isMockMode: jest.fn().mockReturnValue(true),
    callsHmrc: jest.fn().mockReturnValue(false),
    forceSandbox: jest.fn().mockReturnValue(false),
    usesSandboxHost: jest.fn().mockReturnValue(true),
    mode: jest.fn().mockReturnValue("mock"),
    defaultEnvironment: jest.fn().mockReturnValue(HmrcEnvironment.SANDBOX),
  };
  const audit = { record: jest.fn() };
  const service = new HmrcClientService(oauth as never, http as never, apps as never, audit as never);

  beforeEach(() => {
    jest.clearAllMocks();
    apps.isLiveMode.mockReturnValue(false);
    apps.isMockMode.mockReturnValue(true);
    apps.callsHmrc.mockReturnValue(false);
    apps.forceSandbox.mockReturnValue(false);
    apps.usesSandboxHost.mockReturnValue(true);
    apps.mode.mockReturnValue("mock");
    apps.defaultEnvironment.mockReturnValue(HmrcEnvironment.SANDBOX);
    oauth.getValidAccessToken.mockResolvedValue("access-token");
  });

  it("returns mock VAT obligations without calling HMRC in mock mode", async () => {
    const result = await service.get<{ obligations: Array<{ periodKey: string }> }>(
      "/organisations/vat/888888888/obligations",
      "client-1",
      "sandbox",
    );
    expect(result.data.obligations.map((item) => item.periodKey)).toEqual(["26A1", "25A4"]);
    expect(http.send).not.toHaveBeenCalled();
    expect(oauth.getValidAccessToken).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "hmrc.client.mock" }));
  });

  it("returns mock ITSA quarterly, EOPS, and final-declaration payloads", async () => {
    const update = await service.post("/income-tax/AA123456A/updates", { periodId: "q1" }, "client-1");
    const property = await service.put("/income-tax/AA123456A/uk-property/periodic", { periodId: "q1" }, "client-1");
    const eops = await service.post("/income-tax/AA123456A/eops", { finalised: true }, "client-1");
    const final = await service.post("/income-tax/AA123456A/calculations/final-declaration", { calculationId: "calc-1" }, "client-1");
    expect(update.data).toEqual({ periodId: "q1" });
    expect(property.data).toEqual({ periodId: "q1" });
    expect(eops.data).toEqual(expect.objectContaining({ processingDate: expect.any(String) }));
    expect(final.data).toEqual({ calculationId: "calc-1" });
  });

  it("uses a mock access token when no connection exists in mock mode", async () => {
    apps.isLiveMode.mockReturnValue(false);
    oauth.getValidAccessToken.mockRejectedValue(new Error("Client is not connected to HMRC"));
    http.send.mockResolvedValue({ ok: true, status: 200, body: { ok: true }, correlationId: "c1" });

    const result = await service.get("/organisations/vat/888888888/liabilities", "client-1", "sandbox");
    expect(result.data).toEqual({ ok: true });
    expect(http.send).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "mock-access-token", clientId: "client-1" }),
      "GET",
      "/organisations/vat/888888888/liabilities",
      expect.any(Object),
    );
  });

  it("does not fall back to a mock token when a live refresh fails", async () => {
    apps.isLiveMode.mockReturnValue(false);
    oauth.getValidAccessToken.mockRejectedValue(
      new HmrcOAuthError(HMRC_OAUTH_ERR.REFRESH_FAILED, "HMRC token refresh failed"),
    );
    await expect(service.get("/organisations/vat/888888888/liabilities", "client-1", "sandbox")).rejects.toMatchObject({
      errorCode: HMRC_ERR.TOKEN_REFRESH_FAILED,
    });
    expect(http.send).not.toHaveBeenCalled();
  });

  it("refreshes the access token and retries once after a 401", async () => {
    apps.isLiveMode.mockReturnValue(true);
    apps.isMockMode.mockReturnValue(false);
    apps.callsHmrc.mockReturnValue(true);
    apps.mode.mockReturnValue("sandbox");
    oauth.getValidAccessToken.mockResolvedValueOnce("expired-token").mockResolvedValueOnce("fresh-token");
    http.send
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        body: { message: "access token expired" },
        correlationId: "c1",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: { payments: [{ amount: 10, received: "2026-02-10" }] },
        correlationId: "c2",
      });

    const result = await service.get<{ payments: Array<{ amount: number }> }>(
      "/organisations/vat/888888888/payments",
      "client-1",
      "sandbox",
    );
    expect(result.data.payments).toEqual([{ amount: 10, received: "2026-02-10" }]);
    expect(oauth.getValidAccessToken).toHaveBeenCalledTimes(2);
    expect(http.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ accessToken: "fresh-token" }),
      "GET",
      "/organisations/vat/888888888/payments",
      expect.any(Object),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "hmrc.client.call" }));
  });

  it("maps a live 429 onto HMRC_ERR_RATE_LIMIT and audits the failure", async () => {
    apps.isLiveMode.mockReturnValue(true);
    apps.isMockMode.mockReturnValue(false);
    apps.callsHmrc.mockReturnValue(true);
    apps.mode.mockReturnValue("sandbox");
    http.send.mockResolvedValue({ ok: false, status: 429, body: { message: "slow down" }, correlationId: "c" });
    await expect(service.get("/organisations/vat/888888888/payments", "client-1", "live")).rejects.toBeInstanceOf(
      HmrcClientError,
    );
    await expect(service.get("/organisations/vat/888888888/payments", "client-1", "live")).rejects.toMatchObject({
      errorCode: HMRC_ERR.RATE_LIMIT,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "hmrc.client.failed",
        metadata: expect.objectContaining({ errorCode: HMRC_ERR.RATE_LIMIT }),
      }),
    );
  });

  it("expands live ITSA obligation URLs onto the official HMRC feeds", async () => {
    apps.isLiveMode.mockReturnValue(true);
    apps.isMockMode.mockReturnValue(false);
    apps.callsHmrc.mockReturnValue(true);
    apps.mode.mockReturnValue("sandbox");
    http.send.mockResolvedValue({ ok: true, status: 200, body: { obligations: [] }, correlationId: "c" });
    await service.get("/income-tax/AA123456A/obligations", "client-1", "sandbox");
    expect(http.send.mock.calls.map((call) => call[2])).toEqual([
      "/obligations/details/AA123456A/income-and-expenditure",
      "/obligations/details/AA123456A/eops",
      "/obligations/details/AA123456A/crystallisation",
    ]);
  });

  it("wraps refresh failures from handleTokenRefresh", async () => {
    oauth.getValidAccessToken.mockRejectedValue(new Error("upstream"));
    await expect(service.handleTokenRefresh({ clientId: "client-1", environment: "sandbox" })).rejects.toMatchObject({
      errorCode: HMRC_ERR.TOKEN_REFRESH_FAILED,
    });
  });

  it("routes every HMRC call to sandbox when sandbox=true on the request scope", async () => {
    apps.isLiveMode.mockReturnValue(true);
    apps.isMockMode.mockReturnValue(false);
    apps.callsHmrc.mockReturnValue(true);
    apps.forceSandbox.mockReturnValue(false);
    apps.mode.mockReturnValue("live");
    http.send.mockResolvedValue({ ok: true, status: 200, body: { payments: [] }, correlationId: "s" });
    await runHmrcScope({ sandbox: true, environment: "sandbox" }, () =>
      service.get("/organisations/vat/888888888/payments", "client-1", "live"),
    );
    expect(http.send).toHaveBeenCalledWith(
      expect.objectContaining({ environment: HmrcEnvironment.SANDBOX }),
      "GET",
      "/organisations/vat/888888888/payments",
      expect.any(Object),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ sandbox: true, environment: HmrcEnvironment.SANDBOX }) }),
    );
  });

  it("exposes handleHMRCError as a structured HmrcClientError", () => {
    expect(() => service.handleHMRCError({ status: 403, body: { message: "missing write:vat scope" } })).toThrow(
      HmrcClientError,
    );
    try {
      service.handleHMRCError({ status: 403, body: { message: "missing write:vat scope" } });
    } catch (error) {
      expect(error).toMatchObject({ errorCode: HMRC_ERR.INVALID_SCOPE });
    }
  });
});
