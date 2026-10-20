import { decodeUploadContent, detectReceiptType } from "./file-types";

describe("receipt file types", () => {
  it("accepts jpg, png and pdf and rejects other extensions", () => {
    expect(detectReceiptType("fuel.jpg")).toBe("jpg");
    expect(detectReceiptType("scan.JPEG")).toBe("jpg");
    expect(detectReceiptType("office.png")).toBe("png");
    expect(detectReceiptType("invoice.pdf")).toBe("pdf");
    expect(detectReceiptType("notes.docx")).toBeNull();
    expect(detectReceiptType("photo.webp")).toBeNull();
  });

  it("sniffs magic bytes when the name is missing an extension", () => {
    expect(detectReceiptType("receipt", undefined, Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(detectReceiptType("receipt", undefined, Buffer.from("%PDF-1.4"))).toBe("pdf");
  });

  it("decodes data-URL base64 payloads", () => {
    const encoded = Buffer.from("hello").toString("base64");
    expect(decodeUploadContent(`data:application/pdf;base64,${encoded}`).toString()).toBe("hello");
  });
});
