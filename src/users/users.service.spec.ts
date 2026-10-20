import { BadRequestException } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  const prisma = {
    user: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  };
  const audit = { record: jest.fn() };
  const hasher = { hash: jest.fn(), assertPolicy: jest.fn() };
  const service = new UsersService(prisma as never, audit as never, hasher as never);
  const actor = { id: "admin", role: UserRole.ADMIN, firmId: "f1", clientId: null, name: "Priya", email: "p" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("invites staff without a password", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: "u2",
      name: "Noah",
      email: "noah@northbridge.test",
      role: UserRole.ASSISTANT,
      status: UserStatus.INVITED,
    });
    const created = await service.create(actor, {
      name: "Noah Adeyemi",
      email: "noah@northbridge.test",
      role: UserRole.ASSISTANT,
    });
    expect(created.status).toBe(UserStatus.INVITED);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: UserStatus.INVITED, passwordHash: null }) }),
    );
  });

  it("deactivates another user", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "u2", firmId: "f1" });
    prisma.user.update.mockResolvedValue({ id: "u2", status: UserStatus.SUSPENDED });
    await expect(service.update(actor, "u2", { status: UserStatus.SUSPENDED })).resolves.toEqual({
      id: "u2",
      status: UserStatus.SUSPENDED,
    });
  });

  it("blocks self-deactivation", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "admin", firmId: "f1" });
    await expect(service.update(actor, "admin", { status: UserStatus.SUSPENDED })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
