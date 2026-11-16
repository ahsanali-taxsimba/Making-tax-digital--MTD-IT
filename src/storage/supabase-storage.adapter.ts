import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { STORAGE_DRIVER, StoragePort, StoredObject } from "./storage.types";

@Injectable()
export class SupabaseStorageAdapter implements StoragePort {
  readonly driver = STORAGE_DRIVER.SUPABASE;
  private readonly logger = new Logger(SupabaseStorageAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async put(key: string, body: Buffer, mimeType: string): Promise<StoredObject> {
    const response = await this.request("POST", key, body, mimeType);
    if (!response.ok && response.status !== 409) {
      this.logger.warn(`Supabase upload failed (${response.status})`);
      throw new ServiceUnavailableException("Supabase storage upload failed");
    }
    return { key, sizeBytes: body.length, mimeType };
  }

  async get(key: string): Promise<{ body: Buffer; mimeType: string }> {
    const response = await this.request("GET", key);
    if (response.status === 404) {
      throw new NotFoundException("Stored file was not found");
    }
    if (!response.ok) {
      throw new ServiceUnavailableException("Supabase storage download failed");
    }
    const mimeType = response.headers.get("content-type") ?? "application/octet-stream";
    return { body: Buffer.from(await response.arrayBuffer()), mimeType };
  }

  async ready(): Promise<boolean> {
    return Boolean(this.baseUrl() && this.serviceKey() && this.bucket());
  }

  private async request(method: "GET" | "POST" | "PUT", key: string, body?: Buffer, mimeType?: string) {
    const url = `${this.baseUrl()}/storage/v1/object/${this.bucket()}/${encodeURI(key)}`;
    return fetch(url, {
      method: method === "POST" ? "POST" : method,
      headers: {
        Authorization: `Bearer ${this.serviceKey()}`,
        apikey: this.serviceKey(),
        ...(body ? { "Content-Type": mimeType ?? "application/octet-stream", "x-upsert": "true" } : {}),
      },
      body: body ? new Uint8Array(body) : undefined,
    });
  }

  private baseUrl(): string {
    return (this.config.get<string>("storage.supabaseUrl") ?? "").replace(/\/$/, "");
  }

  private serviceKey(): string {
    return this.config.get<string>("storage.supabaseServiceRoleKey") ?? "";
  }

  private bucket(): string {
    return this.config.get<string>("storage.supabaseBucket") ?? "mtd-documents";
  }
}
