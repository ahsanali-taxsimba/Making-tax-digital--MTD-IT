import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthorizationError } from "../authorization/authorization.errors";
import type { AuthUser } from "../common/types";
import { AuditService } from "./audit.service";
import { hashAuditEntry } from "./domain/hash";

describe("AuditService", () => {
  const prisma = {
    auditLog: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };
  const authz = {
    isPlatform: jest.fn(),
    assertCanAccessClientData: jest.fn(),
  };
  const service = new AuditService(prisma as never, authz as never);

  const accountant: AuthUser = {
    id: "u1",
    email: "james@northbridge.test",
    name: "James",
    role: UserRole.ACCOUNTANT,
    firmId: "firm-a",
    clientId: null,
    principal: "firm",
    firmRole: "firm_accountant",
  };
  const platform: AuthUser = {
    id: "p1",
    email: "ivan.p@example.net",
    name: "Owen",
    role: UserRole.ADMIN,
    firmId: "",
    clientId: null,
    principal: "platform",
    platformRole: "admin_owner",
  };
  const client: AuthUser = {
    id: "c1",
    email: "tom.h@example.org",
    name: "Amelia",
    role: UserRole.CLIENT,
    firmId: "firm-a",
    clientId: "client-1",
    principal: "firm",
    firmRole: "firm_client",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    authz.isPlatform.mockReturnValue(false);
    prisma.auditLog.findFirst.mockResolvedValue(null);
    prisma.auditLog.create.mockResolvedValue({ id: "a1" });
    prisma.auditLog.findMany.mockResolvedValue([]);
  });

  it("writes an immutable hashed entry scoped to the actor firm", async () => {
    prisma.auditLog.findFirst.mockResolvedValue({ entryHash: "prev-hash" });
    await service.log({
      actor: accountant,
      clientId: "client-1",
      action: "vat.return.submitted",
      resourceType: "vat_return",
      resourceId: "vat-1",
      beforeData: { status: "DRAFT" },
      afterData: { status: "SUBMITTED" },
      metadata: { periodKey: "26A1" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    const data = prisma.auditLog.create.mock.calls[0][0].data;
    expect(data.firmId).toBe("firm-a");
    expect(data.clientId).toBe("client-1");
    expect(data.action).toBe("vat.return.submitted");
    expect(data.resourceType).toBe("vat_return");
    expect(data.resourceId).toBe("vat-1");
    expect(data.beforeData).toEqual({ status: "DRAFT" });
    expect(data.afterData).toEqual({ status: "SUBMITTED" });
    expect(data.prevHash).toBe("prev-hash");
    expect(data.entryHash).toBe(
      hashAuditEntry({
        prevHash: "prev-hash",
        firmId: "firm-a",
        clientId: "client-1",
        userId: "u1",
        action: "vat.return.submitted",
        resourceType: "vat_return",
        resourceId: "vat-1",
        beforeData: { status: "DRAFT" },
        afterData: { status: "SUBMITTED" },
        metadata: { periodKey: "26A1" },
        createdAt: data.createdAt.toISOString(),
      }),
    );
  });

  it("refuses to write an audit entry for another firm", async () => {
    await expect(
      service.log({
        actor: accountant,
        firmId: "firm-b",
        action: "document.uploaded",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("keeps record() as a compatible wrapper around log()", async () => {
    await service.record({
      actor: accountant,
      actionType: "auth.login",
      metadata: { email: accountant.email },
    });
    const data = prisma.auditLog.create.mock.calls[0][0].data;
    expect(data.action).toBe("auth.login");
    expect(data.actionType).toBe("auth.login");
    expect(data.resourceType).toBe("user");
  });

  it("denies platform staff listing or exporting a client audit trail", async () => {
    authz.isPlatform.mockReturnValue(true);
    await expect(service.list(platform, { clientId: "client-1" })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.export(platform, { clientId: "client-1", period: "2026-04" })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("denies listing another firm's audit trail", async () => {
    await expect(service.list(accountant, { firmId: "firm-b" })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("stops a client reading another client's trail", async () => {
    await expect(service.export(client, { clientId: "client-2", period: "2026-04" })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("exports a firm-scoped trail with hash-chain integrity", async () => {
    const firstHash = "aa".repeat(32);
    const secondHash = "bb".repeat(32);
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: "a1",
        actorUserId: "u1",
        firmId: "firm-a",
        clientId: "client-1",
        actionType: "document.uploaded",
        action: "document.uploaded",
        resourceType: "document",
        resourceId: "doc-1",
        beforeData: null,
        afterData: { fileName: "receipt.pdf" },
        metadata: { documentId: "doc-1" },
        prevHash: null,
        entryHash: firstHash,
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        actor: { id: "u1", name: "James", email: "james@northbridge.test", role: "ACCOUNTANT" },
        client: { id: "client-1", name: "Amelia Hartley" },
      },
      {
        id: "a2",
        actorUserId: "u1",
        firmId: "firm-a",
        clientId: "client-1",
        actionType: "vat.return.submitted",
        action: "vat.return.submitted",
        resourceType: "vat_return",
        resourceId: "vat-1",
        beforeData: { status: "DRAFT" },
        afterData: { status: "SUBMITTED" },
        metadata: { vatReturnId: "vat-1" },
        prevHash: firstHash,
        entryHash: secondHash,
        createdAt: new Date("2026-05-02T00:00:00.000Z"),
        actor: { id: "u1", name: "James", email: "james@northbridge.test", role: "ACCOUNTANT" },
        client: { id: "client-1", name: "Amelia Hartley" },
      },
    ]);
    const exported = await service.export(accountant, { clientId: "client-1", period: "2026-04" });
    expect(authz.assertCanAccessClientData).toHaveBeenCalledWith(accountant, { firmId: "firm-a", clientId: "client-1" });
    expect(exported.firmId).toBe("firm-a");
    expect(exported.entryCount).toBe(2);
    expect(exported.chainIntact).toBe(true);
    expect(exported.entries[0].userId).toBe("u1");
    expect(exported.entries[1].beforeData).toEqual({ status: "DRAFT" });
    expect(exported.period?.start).toBe("2026-04-06T00:00:00.000Z");
  });

  it("surfaces AuthorizationError from tenant checks", async () => {
    authz.assertCanAccessClientData.mockImplementation(() => {
      throw new AuthorizationError("AUTHZ_ERR_CROSS_FIRM", "Cross-firm access is not allowed");
    });
    await expect(service.list(accountant, { clientId: "client-1" })).rejects.toBeInstanceOf(AuthorizationError);
  });
});
