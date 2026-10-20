import { MessagesService } from "./messages.service";

describe("MessagesService", () => {
  const clients = { get: jest.fn() };
  const prisma = {
    clientMessage: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };
  const service = new MessagesService(prisma as never, clients as never);
  const user = { id: "u1", name: "Amelia Hartley", role: "CLIENT", firmId: "f1", clientId: "c1" };

  beforeEach(() => {
    jest.clearAllMocks();
    clients.get.mockResolvedValue({ id: "c1" });
  });

  it("lists the thread for a scoped client", async () => {
    prisma.clientMessage.findMany.mockResolvedValue([{ id: "m1", body: "Hello" }]);
    await expect(service.list(user as never, "c1")).resolves.toEqual([{ id: "m1", body: "Hello" }]);
    expect(clients.get).toHaveBeenCalledWith(user, "c1");
  });

  it("stores the author details on send", async () => {
    prisma.clientMessage.create.mockResolvedValue({ id: "m2" });
    await service.create(user as never, "c1", "Please review Q1");
    expect(prisma.clientMessage.create).toHaveBeenCalledWith({
      data: {
        clientId: "c1",
        authorId: "u1",
        authorRole: "CLIENT",
        authorName: "Amelia Hartley",
        body: "Please review Q1",
      },
    });
  });
});
