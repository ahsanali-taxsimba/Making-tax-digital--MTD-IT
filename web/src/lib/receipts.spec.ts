import { receiptKindLabel } from "./receipts";

describe("receipt helpers", () => {
  it("labels image and PDF types", () => {
    expect(receiptKindLabel("pdf")).toBe("PDF");
    expect(receiptKindLabel("jpg")).toBe("JPG");
  });
});
