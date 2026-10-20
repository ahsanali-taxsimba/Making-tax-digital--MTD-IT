import { DocumentKind } from "@prisma/client";
import { DocumentsService } from "./documents.service";

describe("DocumentsService", () => {
  const prisma = { supportingDocument: { findMany: jest.fn(), create: jest.fn() } };
  const clients = { get: jest.fn() };
  const repo = {
    create: jest.fn(),
    find: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
  };
  const attachments = { attach: jest.fn(), detach: jest.fn(), syncAttachedTo: jest.fn() };
  const tags = { apply: jest.fn(), list: jest.fn() };
  const searchEngine = { search: jest.fn() };
  const audit = { record: jest.fn() };
  const storage = { put: jest.fn(), get: jest.fn() };
  const ocr = { extract: jest.fn() };
  const service = new DocumentsService(
    prisma as never,
    clients as never,
    repo as never,
    attachments as never,
    tags as never,
    searchEngine as never,
    audit as never,
    storage as never,
    ocr as never,
  );
  const actor = { id: "u1", role: "ADMIN", firmId: "f1", clientId: null, name: "Priya", email: "p" } as never;
  const pdf = Buffer.from("%PDF-1.4 document", "utf8").toString("base64");

  beforeEach(() => {
    jest.clearAllMocks();
    clients.get.mockResolvedValue({ id: "c1", firmId: "f1" });
    storage.put.mockResolvedValue("/documents/file/key");
    ocr.extract.mockResolvedValue({
      text: "HMRC Self Assessment notice",
      merchantName: null,
      amount: null,
      date: "2026-04-01",
      invoiceNumber: null,
    });
    repo.create.mockImplementation(async (data: { id: string }) => ({
      id: data.id,
      clientId: "c1",
      type: DocumentKind.HMRC_LETTER,
      fileName: "hmrc-letter.pdf",
      fileType: "pdf",
      fileSize: 20,
      storageUrl: "/documents/file/key",
      ocrText: "HMRC Self Assessment notice",
      ocrMerchant: null,
      ocrAmount: null,
      ocrDate: new Date("2026-04-01"),
      ocrInvoiceNumber: null,
      tags: ["hmrc"],
      attachedTo: { clientId: "c1" },
      uploadedByUserId: "u1",
      uploadedAt: new Date("2026-04-02"),
      tagLinks: [],
    }));
    tags.apply.mockImplementation(async (id: string, names: string[]) => ({
      id,
      clientId: "c1",
      type: DocumentKind.HMRC_LETTER,
      fileName: "hmrc-letter.pdf",
      fileType: "pdf",
      fileSize: 20,
      storageUrl: "/documents/file/key",
      ocrText: "HMRC Self Assessment notice",
      tags: names,
      attachedTo: { clientId: "c1" },
      uploadedByUserId: "u1",
      uploadedAt: new Date("2026-04-02"),
    }));
  });

  it("uploads a PDF, stores it, runs OCR and tags it", async () => {
    const result = await service.upload(actor, {
      clientId: "c1",
      fileName: "hmrc-letter.pdf",
      content: pdf,
      type: "hmrc_letter",
      tags: ["hmrc"],
    });
    expect(storage.put).toHaveBeenCalled();
    expect(ocr.extract).toHaveBeenCalled();
    expect(result.type).toBe("hmrc_letter");
    expect(result.ocrText).toContain("HMRC");
    expect(result.tags).toEqual(["hmrc"]);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "document.uploaded" }));
  });

  it("lists the document library and searches OCR text", async () => {
    repo.list.mockResolvedValue([
      {
        id: "d1",
        clientId: "c1",
        type: DocumentKind.RECEIPT,
        fileName: "bp.jpg",
        fileType: "jpg",
        fileSize: 10,
        storageUrl: "/x",
        ocrText: "BP CONNECT",
        tags: ["fuel"],
        attachedTo: { clientId: "c1" },
        uploadedByUserId: "u1",
        uploadedAt: new Date(),
      },
    ]);
    searchEngine.search.mockResolvedValue([
      {
        row: {
          id: "d1",
          clientId: "c1",
          type: DocumentKind.RECEIPT,
          fileName: "bp.jpg",
          fileType: "jpg",
          fileSize: 10,
          storageUrl: "/x",
          ocrText: "BP CONNECT",
          tags: ["fuel"],
          attachedTo: { clientId: "c1" },
          uploadedByUserId: "u1",
          uploadedAt: new Date(),
        },
        score: 5,
      },
    ]);
    const listed = await service.listLibrary(actor, { clientId: "c1", type: "receipt" });
    expect(listed.count).toBe(1);
    expect(listed.documents[0].type).toBe("receipt");
    const found = await service.search(actor, { clientId: "c1", q: "bp" });
    expect(found.documents[0].score).toBe(5);
  });

  it("keeps the portal supporting-document list", async () => {
    prisma.supportingDocument.findMany.mockResolvedValue([{ id: "s1", fileName: "old.pdf" }]);
    await expect(service.list(actor, "c1")).resolves.toEqual([{ id: "s1", fileName: "old.pdf" }]);
  });
});
