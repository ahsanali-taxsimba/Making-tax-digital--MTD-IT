import { NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { ClientsService } from "./clients.service";

describe("ClientsService.me", () => {
  const repo = { list: jest.fn(), findInFirm: jest.fn() };
  const authz = { assertCanAccessClientData: jest.fn(), assertFirm: jest.fn() };
  const service = new ClientsService(repo as never, {} as never, {} as never, {} as never, authz as never);

  it("returns the linked client for a portal user", async () => {
    repo.findInFirm.mockResolvedValue({ id: "c1", firmId: "f1", name: "Amelia" });
    const user = { id: "u", role: UserRole.CLIENT, firmId: "f1", clientId: "c1", name: "Amelia", email: "a" };
    await expect(service.me(user)).resolves.toEqual({ id: "c1", firmId: "f1", name: "Amelia" });
  });

  it("fails when staff have no clients", async () => {
    repo.list.mockResolvedValue([]);
    const user = { id: "u", role: UserRole.ACCOUNTANT, firmId: "f1", clientId: null, name: "Priya", email: "p" };
    await expect(service.me(user)).rejects.toBeInstanceOf(NotFoundException);
  });
});
