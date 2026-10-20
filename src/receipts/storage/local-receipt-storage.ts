import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { ReceiptStorage } from "./receipt-storage";

@Injectable()
export class LocalReceiptStorage implements ReceiptStorage {
  constructor(private readonly config: ConfigService) {}

  private root() {
    return this.config.get<string>("receipts.localDir") || path.join(process.cwd(), "var", "receipts");
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<string> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
    return `/receipts/file/${encodeURIComponent(key)}`;
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async remove(key: string): Promise<void> {
    await unlink(this.resolve(key)).catch(() => undefined);
  }

  private resolve(key: string) {
    const safe = key.replace(/^\/+/, "");
    return path.join(this.root(), safe);
  }
}
