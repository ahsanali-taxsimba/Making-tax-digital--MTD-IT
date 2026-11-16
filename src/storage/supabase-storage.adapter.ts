import { Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { STORAGE_DRIVER, StoragePort, StoredObject } from "./storage.types";

@Injectable()
export class SupabaseStorageAdapter implements StoragePort, OnModuleInit {
  readonly driver = STORAGE_DRIVER.SUPABASE;
  private readonly logger = new Logger(SupabaseStorageAdapter.name);
  private client?: SupabaseClient;
  private bucketEnsured = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>("storage.driver") !== STORAGE_DRIVER.SUPABASE) {
      return;
    }
    if (this.config.get<string>("nodeEnv") === "test") {
      return;
    }
    try {
      await this.ensureBucket();
    } catch (error) {
      this.logger.warn(`Could not ensure Supabase bucket: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  async put(key: string, body: Buffer, mimeType: string): Promise<StoredObject> {
    await this.ensureBucket();
    const { error } = await this.supabase().storage.from(this.bucket()).upload(key, body, {
      contentType: mimeType,
      upsert: true,
    });
    if (error) {
      this.logger.warn(`Supabase upload failed: ${error.message}`);
      throw new ServiceUnavailableException("Supabase storage upload failed");
    }
    return { key, sizeBytes: body.length, mimeType };
  }

  async get(key: string): Promise<{ body: Buffer; mimeType: string }> {
    const { data, error } = await this.supabase().storage.from(this.bucket()).download(key);
    if (error || !data) {
      if (error?.message?.toLowerCase().includes("not found")) {
        throw new NotFoundException("Stored file was not found");
      }
      throw new ServiceUnavailableException("Supabase storage download failed");
    }
    return { body: Buffer.from(await data.arrayBuffer()), mimeType: data.type || "application/octet-stream" };
  }

  async ready(): Promise<boolean> {
    if (!this.baseUrl() || !this.serviceKey()) {
      return false;
    }
    try {
      const { error } = await this.supabase().storage.getBucket(this.bucket());
      return !error;
    } catch {
      return false;
    }
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketEnsured) {
      return;
    }
    const name = this.bucket();
    const existing = await this.supabase().storage.getBucket(name);
    if (!existing.error) {
      this.bucketEnsured = true;
      return;
    }
    const created = await this.supabase().storage.createBucket(name, {
      public: false,
      fileSizeLimit: this.config.get<number>("storage.maxUploadBytes") ?? 10 * 1024 * 1024,
    });
    if (created.error && !/already exists|duplicate/i.test(created.error.message)) {
      throw created.error;
    }
    this.bucketEnsured = true;
    this.logger.log(`Supabase bucket ready: ${name}`);
  }

  private supabase(): SupabaseClient {
    if (!this.client) {
      const url = this.baseUrl();
      const key = this.serviceKey();
      if (!url || !key) {
        throw new ServiceUnavailableException("Supabase storage is not configured");
      }
      this.client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return this.client;
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
