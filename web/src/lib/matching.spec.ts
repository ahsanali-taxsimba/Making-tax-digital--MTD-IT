import { matchingKindLabel } from "./matching";

describe("matching helpers", () => {
  it("labels invoice and bill documents", () => {
    expect(matchingKindLabel("invoice")).toBe("Sales invoice");
    expect(matchingKindLabel("bill")).toBe("Purchase bill");
  });
});
