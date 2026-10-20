import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import * as bcrypt from "bcrypt";
import { argon2id, argon2Verify } from "hash-wasm";

const ARGON2_PREFIX = "$argon2";
const MEMORY_KIB = 4096;
const ITERATIONS = 3;
const PARALLELISM = 1;
const HASH_LENGTH = 32;

@Injectable()
export class PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    return argon2id({
      password,
      salt,
      parallelism: PARALLELISM,
      iterations: ITERATIONS,
      memorySize: MEMORY_KIB,
      hashLength: HASH_LENGTH,
      outputType: "encoded",
    });
  }

  async verify(password: string, stored: string): Promise<boolean> {
    if (!stored) {
      return false;
    }
    if (stored.startsWith(ARGON2_PREFIX)) {
      try {
        return await argon2Verify({ password, hash: stored });
      } catch {
        return false;
      }
    }
    if (stored.startsWith("$2")) {
      return bcrypt.compare(password, stored);
    }
    return false;
  }

  needsRehash(stored: string): boolean {
    return Boolean(stored) && !stored.startsWith(ARGON2_PREFIX);
  }

  assertPolicy(password: string): void {
    if (password.length < 12) {
      throw new Error("PASSWORD_TOO_SHORT");
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      throw new Error("PASSWORD_COMPLEXITY");
    }
  }
}
