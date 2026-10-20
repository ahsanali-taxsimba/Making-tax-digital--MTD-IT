import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, createHash } from "crypto";
import { RECEIPT_ERR, ReceiptError } from "../receipts.errors";
import { ReceiptStorage } from "./receipt-storage";

@Injectable()
export class S3ReceiptStorage implements ReceiptStorage {
  constructor(private readonly config: ConfigService) {}

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    const url = this.objectUrl(key);
    await this.request("PUT", url, body, contentType);
    return url;
  }

  async get(key: string): Promise<Buffer> {
    const url = this.objectUrl(key);
    const response = await this.request("GET", url);
    return Buffer.from(await response.arrayBuffer());
  }

  async remove(key: string): Promise<void> {
    await this.request("DELETE", this.objectUrl(key));
  }

  private objectUrl(key: string) {
    const endpoint = (this.config.get<string>("receipts.s3.endpoint") ?? "").replace(/\/$/, "");
    const bucket = this.config.get<string>("receipts.s3.bucket") ?? "receipts";
    return `${endpoint}/${bucket}/${key.replace(/^\/+/, "")}`;
  }

  private async request(method: string, url: string, body?: Buffer, contentType?: string) {
    const headers: Record<string, string> = {};
    if (contentType) {
      headers["Content-Type"] = contentType;
    }
    const accessKey = this.config.get<string>("receipts.s3.accessKey") ?? "";
    const secretKey = this.config.get<string>("receipts.s3.secretKey") ?? "";
    if (accessKey && secretKey) {
      Object.assign(
        headers,
        signAws4({
          method,
          url,
          body: body ?? Buffer.alloc(0),
          contentType: contentType ?? "application/octet-stream",
          region: this.config.get<string>("receipts.s3.region") ?? "eu-west-2",
          accessKey,
          secretKey,
        }),
      );
    }
    const response = await fetch(url, { method, headers, body: body && method !== "GET" ? new Uint8Array(body) : undefined });
    if (!response.ok) {
      throw new ReceiptError(RECEIPT_ERR.STORAGE_FAILED, `Receipt storage ${method} failed (${response.status})`);
    }
    return response;
  }
}

function signAws4(input: {
  method: string;
  url: string;
  body: Buffer;
  contentType: string;
  region: string;
  accessKey: string;
  secretKey: string;
}): Record<string, string> {
  const parsed = new URL(input.url);
  const amzDate = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = createHash("sha256").update(input.body).digest("hex");
  const canonicalHeaders = [
    `host:${parsed.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join("\n");
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonical = [
    input.method,
    parsed.pathname,
    parsed.searchParams.toString(),
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${dateStamp}/${input.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonical).digest("hex")].join("\n");
  const kDate = createHmac("sha256", `AWS4${input.secretKey}`).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(input.region).digest();
  const kService = createHmac("sha256", kRegion).update("s3").digest();
  const signingKey = createHmac("sha256", kService).update("aws4_request").digest();
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return {
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    Authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
