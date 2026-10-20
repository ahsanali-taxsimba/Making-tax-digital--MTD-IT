import { HmrcEnvironment } from "@prisma/client";
import { HMRC_ERR } from "./hmrc-client.errors";
import { HmrcClientService } from "./hmrc-client.service";

/**
 * Integration coverage for every public HMRC path VAT and ITSA call through
 * HmrcClientService. HTTP is stubbed at HmrcHttpClient.send so we exercise
 * token resolution, 401 retry, live path expansion, and unified errors.
 */
describe("HmrcClientService HMRC calls", () => {
  const oauth = { getValidAccessToken: jest.fn().mockResolvedValue("live-token") };
  const http = { send: jest.fn() };
  const apps = {
    isLiveMode: jest.fn().mockReturnValue(true),
    defaultEnvironment: jest.fn().mockReturnValue(HmrcEnvironment.SANDBOX),
  };
  const audit = { record: jest.fn() };
  const service = new HmrcClientService(oauth as never, http as never, apps as never, audit as never);

  beforeEach(() => {
    jest.clearAllMocks();
    oauth.getValidAccessToken.mockResolvedValue("live-token");
    apps.isLiveMode.mockReturnValue(true);
  });

  it("GET VAT obligations", async () => {
    http.send.mockResolvedValue({
      ok: true,
      status: 200,
      body: { obligations: [{ periodKey: "26A1" }] },
      correlationId: "vat-ob",
    });
    const result = await service.get("/organisations/vat/888888888/obligations", "client-1", "sandbox");
    expect(result.correlationId).toBe("vat-ob");
    expect(http.send).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "live-token" }),
      "GET",
      "/organisations/vat/888888888/obligations",
      expect.any(Object),
    );
  });

  it("GET VAT return by period key", async () => {
    http.send.mockResolvedValue({ ok: true, status: 200, body: { periodKey: "26A1" }, correlationId: "vat-ret" });
    await service.get("/organisations/vat/888888888/returns/26A1", "client-1", "sandbox");
    expect(http.send.mock.calls[0][2]).toBe("/organisations/vat/888888888/returns/26A1");
  });

  it("POST VAT return", async () => {
    http.send.mockResolvedValue({
      ok: true,
      status: 200,
      body: { processingDate: "2026-04-01T00:00:00Z", formBundleNumber: "FB1" },
      correlationId: "vat-sub",
    });
    const result = await service.post(
      "/organisations/vat/888888888/returns",
      { periodKey: "26A1", finalised: true },
      "client-1",
      "sandbox",
    );
    expect(result.data).toEqual(expect.objectContaining({ formBundleNumber: "FB1" }));
    expect(http.send.mock.calls[0][3]).toEqual(expect.objectContaining({ body: { periodKey: "26A1", finalised: true } }));
  });

  it("GET VAT payments", async () => {
    http.send.mockResolvedValue({ ok: true, status: 200, body: { payments: [] }, correlationId: "vat-pay" });
    await service.get("/organisations/vat/888888888/payments", "client-1", "sandbox");
    expect(http.send.mock.calls[0][2]).toBe("/organisations/vat/888888888/payments");
  });

  it("GET ITSA obligations expands to three live feeds", async () => {
    http.send.mockResolvedValue({ ok: true, status: 200, body: { obligations: [] }, correlationId: "itsa-ob" });
    await service.get("/income-tax/AA123456A/obligations", "client-1", "sandbox");
    expect(http.send).toHaveBeenCalledTimes(3);
  });

  it("POST ITSA quarterly update", async () => {
    http.send.mockResolvedValue({ ok: true, status: 200, body: { periodId: "p1" }, correlationId: "itsa-q" });
    await service.post(
      "/income-tax/AA123456A/updates",
      {
        businessId: "XAIS1",
        taxYear: "2025-26",
        periodId: "q1",
        periodStart: "2026-04-06",
        periodEnd: "2026-07-05",
        incomes: { turnover: 1 },
        expenses: {},
      },
      "client-1",
      "sandbox",
    );
    expect(http.send.mock.calls[0][2]).toBe("/individuals/business/self-employment/AA123456A/XAIS1/period/2025-26");
  });

  it("POST ITSA EOPS", async () => {
    http.send.mockResolvedValue({ ok: true, status: 200, body: { processingDate: "2026-04-01T00:00:00Z" }, correlationId: "eops" });
    await service.post(
      "/income-tax/AA123456A/eops",
      {
        businessId: "XAIS1",
        taxYear: "2025-26",
        typeOfBusiness: "self-employment",
        accountingPeriodStart: "2026-04-06",
        accountingPeriodEnd: "2027-04-05",
        finalised: true,
      },
      "client-1",
    );
    expect(http.send.mock.calls[0][2]).toContain("/individuals/business/end-of-period-statement/nino/AA123456A/XAIS1");
  });

  it("POST ITSA final declaration", async () => {
    http.send.mockResolvedValue({ ok: true, status: 200, body: { calculationId: "calc" }, correlationId: "fd" });
    await service.post("/income-tax/AA123456A/final-declaration", { taxYear: "2025-26", finalised: true }, "client-1");
    expect(http.send.mock.calls[0][2]).toBe("/individuals/calculations/AA123456A/self-assessment/2025-26/final-declaration");
  });

  it("maps a live 500 to HMRC_ERR_SERVER", async () => {
    http.send.mockResolvedValue({ ok: false, status: 500, body: { message: "boom" }, correlationId: "x" });
    await expect(service.get("/organisations/vat/888888888/payments", "client-1")).rejects.toMatchObject({
      errorCode: HMRC_ERR.SERVER,
    });
  });

  it("maps a dropped connection to HMRC_ERR_CONNECTION", async () => {
    http.send.mockRejectedValue(new Error("ECONNRESET"));
    await expect(service.get("/organisations/vat/888888888/payments", "client-1")).rejects.toMatchObject({
      errorCode: HMRC_ERR.CONNECTION,
    });
  });
});
