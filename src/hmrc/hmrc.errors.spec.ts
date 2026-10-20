import { HmrcApiError, mapHmrcError } from "./hmrc.errors";

describe("mapHmrcError", () => {
  it("maps HMRC 401 bodies", () => {
    const error = mapHmrcError(401, { code: "INVALID_CREDENTIALS", message: "Invalid credentials" }, "corr-1");
    expect(error).toBeInstanceOf(HmrcApiError);
    expect(error.code).toBe("INVALID_CREDENTIALS");
    expect(error.correlationId).toBe("corr-1");
    expect(error.statusCode).toBe(401);
  });

  it("falls back when HMRC omits a code", () => {
    const error = mapHmrcError(502, { message: "upstream" });
    expect(error.code).toBe("HMRC_ERR_SERVER");
  });

  it("maps 401 / 429 / network failures onto the shared HMRC_ERR_* codes", () => {
    expect(mapHmrcError(401, {}).code).toBe("HMRC_ERR_UNAUTHORISED");
    expect(mapHmrcError(429, {}).code).toBe("HMRC_ERR_RATE_LIMIT");
    expect(mapHmrcError(0, {}).code).toBe("HMRC_ERR_CONNECTION");
    expect(mapHmrcError(400, {}).code).toBe("HMRC_ERR_BAD_REQUEST");
  });
});
