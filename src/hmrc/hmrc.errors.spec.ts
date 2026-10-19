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
    expect(error.code).toBe("HMRC_ERROR");
  });
});
