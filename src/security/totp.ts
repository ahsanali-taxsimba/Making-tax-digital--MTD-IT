import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP = 30;
const DIGITS = 6;
const WINDOW = 1;

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totp(secret: string, at = Date.now()): string {
  const key = base32Decode(secret);
  const counter = Math.floor(at / 1000 / STEP);
  return hotp(key, counter);
}

export function verifyTotp(secret: string, code: string, at = Date.now()): boolean {
  const expected = String(code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(expected)) {
    return false;
  }
  const key = base32Decode(secret);
  const counter = Math.floor(at / 1000 / STEP);
  for (let offset = -WINDOW; offset <= WINDOW; offset += 1) {
    const candidate = hotp(key, counter + offset);
    if (safeEqual(candidate, expected)) {
      return true;
    }
  }
  return false;
}

export function otpauthUrl(secret: string, email: string, issuer = "Making Tax Digital"): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`;
}

function hotp(key: Buffer, counter: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/g, "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const idx = ALPHABET.indexOf(char);
    if (idx < 0) {
      continue;
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
