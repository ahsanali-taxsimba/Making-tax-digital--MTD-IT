import { HMRC_ERR, handleHMRCError, HmrcClientError } from "./hmrc-client.errors";

describe("handleHMRCError", () => {
  it("maps a network failure to HMRC_ERR_CONNECTION", () => {
    const error = handleHMRCError({ status: 0, body: { message: "network" } });
    expect(error).toBeInstanceOf(HmrcClientError);
    expect(error.errorCode).toBe(HMRC_ERR.CONNECTION);
    expect(error.getStatus()).toBe(502);
  });

  it("maps an expired token to HMRC_ERR_TOKEN_EXPIRED", () => {
    const error = handleHMRCError({
      status: 401,
      body: { code: "INVALID_TOKEN", message: "access token expired" },
      correlationId: "corr-1",
    });
    expect(error.errorCode).toBe(HMRC_ERR.TOKEN_EXPIRED);
    expect(error.correlationId).toBe("corr-1");
  });

  it("maps a generic 401 to HMRC_ERR_UNAUTHORISED", () => {
    const error = handleHMRCError({ status: 401, body: { message: "denied" } });
    expect(error.errorCode).toBe(HMRC_ERR.UNAUTHORISED);
  });

  it("maps missing scopes to HMRC_ERR_INVALID_SCOPE", () => {
    const error = handleHMRCError({ status: 403, body: { message: "insufficient scope" } });
    expect(error.errorCode).toBe(HMRC_ERR.INVALID_SCOPE);
    expect(error.getStatus()).toBe(403);
  });

  it("maps 429 to HMRC_ERR_RATE_LIMIT", () => {
    const error = handleHMRCError({ status: 429, body: { message: "slow down" } });
    expect(error.errorCode).toBe(HMRC_ERR.RATE_LIMIT);
  });

  it("maps 5xx to HMRC_ERR_SERVER", () => {
    const error = handleHMRCError({ status: 503, body: { message: "unavailable" } });
    expect(error.errorCode).toBe(HMRC_ERR.SERVER);
  });

  it("maps other 4xx to HMRC_ERR_BAD_REQUEST", () => {
    const error = handleHMRCError({ status: 400, body: { message: "periodKey is invalid" } });
    expect(error.errorCode).toBe(HMRC_ERR.BAD_REQUEST);
    expect(error.message).toContain("periodKey is invalid");
  });

  it("maps 404 / 409 / generic 403 onto dedicated sandbox error codes", () => {
    expect(handleHMRCError({ status: 404, body: { message: "not found" } }).errorCode).toBe(HMRC_ERR.NOT_FOUND);
    expect(handleHMRCError({ status: 409, body: { message: "duplicate" } }).errorCode).toBe(HMRC_ERR.CONFLICT);
    expect(handleHMRCError({ status: 403, body: { message: "denied" } }).errorCode).toBe(HMRC_ERR.FORBIDDEN);
  });
});
