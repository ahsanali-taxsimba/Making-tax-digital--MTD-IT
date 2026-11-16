import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { LocalStorageAdapter } from "./local-storage.adapter";

describe("LocalStorageAdapter", () => {
  it("writes and reads a file under the configured directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mtd-storage-"));
    const adapter = new LocalStorageAdapter({ get: () => dir } as never);
    await adapter.put("clients/a/receipt.pdf", Buffer.from("%PDF"), "application/pdf");
    const stored = await adapter.get("clients/a/receipt.pdf");
    expect(stored.body.toString()).toBe("%PDF");
    expect(await adapter.ready()).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });
});
