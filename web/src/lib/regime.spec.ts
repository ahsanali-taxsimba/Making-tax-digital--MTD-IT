import { expiredConnectionMessage, regimeFromPath, regimeLabel, regimePath } from "./regime";

describe("regime helpers", () => {
  it("labels and routes VAT and ITSA", () => {
    expect(regimeLabel("itsa")).toBe("ITSA");
    expect(regimePath("itsa")).toBe("/itsa");
    expect(regimeFromPath("/itsa/callback")).toBe("itsa");
    expect(regimeFromPath("/vat")).toBe("vat");
  });

  it("explains an expired ITSA connection", () => {
    expect(expiredConnectionMessage("itsa")).toBe("Your HMRC ITSA connection has expired.");
  });
});
