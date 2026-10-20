import { spawnSync } from "child_process";
import { extractPdfText } from "../domain/ocr";
import { ReceiptFileType } from "../domain/file-types";

export async function extractRawText(input: {
  fileType: ReceiptFileType;
  buffer: Buffer;
  hint?: string;
  fileName?: string;
  driver?: "auto" | "tesseract" | "cloud" | "off";
  endpoint?: string;
  apiKey?: string;
  timeoutMs?: number;
}): Promise<{ text: string; source: "hint" | "pdf" | "tesseract" | "cloud" }> {
  const parts = [input.hint ?? "", input.fileName ?? ""].filter(Boolean);
  let source: "hint" | "pdf" | "tesseract" | "cloud" = input.hint ? "hint" : "pdf";
  if (input.fileType === "pdf") {
    parts.push(extractPdfText(input.buffer));
    source = "pdf";
  }
  const driver = input.driver ?? "auto";
  if (input.fileType !== "pdf" && driver !== "off") {
    if ((driver === "cloud" || driver === "auto") && input.endpoint) {
      const cloud = await extractCloudText(input.buffer, input.endpoint, input.apiKey, input.timeoutMs ?? 8000);
      if (cloud) {
        parts.push(cloud);
        source = "cloud";
      }
    }
    if (source !== "cloud" && driver !== "cloud") {
      const tess = extractTesseractText(input.buffer, input.timeoutMs ?? 8000);
      if (tess) {
        parts.push(tess);
        source = "tesseract";
      }
    }
  }
  return { text: parts.filter(Boolean).join("\n"), source };
}

function extractTesseractText(buffer: Buffer, timeoutMs: number): string | null {
  try {
    const result = spawnSync("tesseract", ["stdin", "stdout", "-l", "eng", "--psm", "6"], {
      input: buffer,
      encoding: "utf8",
      timeout: timeoutMs,
    });
    if (result.status !== 0) {
      return null;
    }
    const text = String(result.stdout ?? "").trim();
    return text.length > 3 ? text : null;
  } catch {
    return null;
  }
}

async function extractCloudText(buffer: Buffer, endpoint: string, apiKey?: string, timeoutMs = 8000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ content: buffer.toString("base64") }),
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { text?: string; data?: { text?: string } };
    const text = body.text ?? body.data?.text ?? "";
    return text.trim().length > 3 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
