import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { STORAGE_DRIVER, StoragePort, StoredObject } from "./storage.types";

@Injectable()
export class LocalStorageAdapter implements StoragePort {
  readonly driver = STORAGE_DRIVER.LOCAL;
  private readonly logger = new Logger(LocalStorageAdapter.name);
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>("storage.localDir") ?? "uploads");
  }

  async put(key: string, body: Buffer, mimeType: string): Promise<StoredObject> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    return { key, sizeBytes: body.length, mimeType };
  }

  async get(key: string): Promise<{ body: Buffer; mimeType: string }> {
    try {
      const body = await readFile(this.pathFor(key));
      return { body, mimeType: "application/octet-stream" };
    } catch {
      throw new NotFoundException("Stored file was not found");
    }
  }

  async ready(): Promise<boolean> {
    try {
      await mkdir(this.root, { recursive: true });
      return true;
    } catch (error) {
      this.logger.warn(`Local storage is not writable: ${error instanceof Error ? error.message : "unknown"}`);
      return false;
    }
  }

  private pathFor(key: string): string {
    const safe = key.replace(/^\/+/, "").replace(/\.\./g, "");
    return join(this.root, safe);
  }
}
