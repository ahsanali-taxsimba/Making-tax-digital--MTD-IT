import { rankDocuments, scoreDocumentHit, tokenizeQuery } from "./search";

describe("document search", () => {
  it("tokenizes a query and scores OCR text highest", () => {
    expect(tokenizeQuery("BP petrol VAT")).toEqual(["bp", "petrol", "vat"]);
    const score = scoreDocumentHit(
      {
        id: "d1",
        fileName: "fuel.jpg",
        type: "receipt",
        ocrText: "BP CONNECT BRIGHTON petrol VAT 20%",
        tags: ["motor"],
        ocrMerchant: "BP",
      },
      "bp petrol",
    );
    expect(score).toBeGreaterThan(5);
  });

  it("ranks matching documents and drops misses", () => {
    const ranked = rankDocuments(
      [
        { id: "a", fileName: "contract.pdf", type: "contract", ocrText: "service agreement", tags: [] },
        { id: "b", fileName: "hmrc-letter.pdf", type: "hmrc_letter", ocrText: "Self Assessment notice", tags: ["hmrc"] },
        { id: "c", fileName: "menu.pdf", type: "receipt", ocrText: "lunch", tags: [] },
      ],
      "hmrc notice",
    );
    expect(ranked.map((row) => row.id)).toEqual(["b"]);
    expect(ranked[0].score).toBeGreaterThan(0);
  });
});
