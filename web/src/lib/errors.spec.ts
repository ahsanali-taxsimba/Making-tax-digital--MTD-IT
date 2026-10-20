import { errorCodeOf, hmrcUserMessage } from "./errors";

describe("hmrcUserMessage", () => {
  it("explains an expired VAT connection", () => {
    expect(hmrcUserMessage("HMRC_ERR_TOKEN_EXPIRED")).toBe("Your HMRC VAT connection has expired.");
  });

  it("explains a failed token refresh", () => {
    expect(hmrcUserMessage("HMRC_ERR_TOKEN_REFRESH_FAILED")).toBe("Unable to refresh HMRC token.");
    expect(hmrcUserMessage("HMRC_OAUTH_ERR_REFRESH_FAILED")).toBe("Unable to refresh HMRC token.");
  });

  it("explains an authorisation failure", () => {
    expect(hmrcUserMessage("HMRC_OAUTH_ERR_TOKEN_EXCHANGE_FAILED")).toBe(
      "HMRC returned an error during authorisation.",
    );
    expect(hmrcUserMessage("HMRC_OAUTH_ERR_INVALID_STATE")).toBe("HMRC returned an error during authorisation.");
  });

  it("reads errorCode from the API envelope", () => {
    expect(errorCodeOf({ errorCode: "HMRC_ERR_RATE_LIMIT", code: "HTTP" })).toBe("HMRC_ERR_RATE_LIMIT");
  });
});
