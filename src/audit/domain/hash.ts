import { createHash } from "crypto";

export function hashAuditEntry(input: {
  prevHash: string | null;
  firmId: string | null;
  clientId: string | null;
  userId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
  createdAt: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        prevHash: input.prevHash,
        firmId: input.firmId,
        clientId: input.clientId,
        userId: input.userId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        beforeData: input.beforeData ?? null,
        afterData: input.afterData ?? null,
        metadata: input.metadata ?? {},
        createdAt: input.createdAt,
      }),
    )
    .digest("hex");
}

export function verifyAuditChain(entries: Array<{ prevHash: string | null; entryHash: string | null }>): boolean {
  return entries.every((entry, index) => {
    if (index === 0) {
      return true;
    }
    return Boolean(entry.prevHash) && entry.prevHash === entries[index - 1]?.entryHash;
  });
}
