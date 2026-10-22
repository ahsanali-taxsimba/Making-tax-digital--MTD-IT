import { NotFoundException } from "@nestjs/common";
import { ObligationStatus, TaskStatus, UserRole } from "@prisma/client";
import { FirmsService } from "./firms.service";

describe("FirmsService", () => {
  const prisma = {
    firm: { findUnique: jest.fn() },
    user: { count: jest.fn(), findMany: jest.fn() },
    client: { count: jest.fn() },
    vatObligation: { count: jest.fn(), findFirst: jest.fn() },
    itsaObligation: { count: jest.fn(), findFirst: jest.fn() },
    task: { findMany: jest.fn(), count: jest.fn() },
    bankTransaction: { count: jest.fn() },
    salesInvoice: { count: jest.fn() },
    documentFile: { count: jest.fn() },
    receiptFile: { count: jest.fn() },
    categorisationSuggestion: { count: jest.fn() },
    matchingSuggestion: { count: jest.fn() },
    mtdConnection: { count: jest.fn() },
  };
  const service = new FirmsService(prisma as never, { record: jest.fn() } as never);
  const actor = { id: "u1", role: UserRole.ADMIN, firmId: "f1", clientId: null, name: "Priya", email: "p" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the current firm without the webhook secret", async () => {
    prisma.firm.findUnique.mockResolvedValue({ id: "f1", name: "Northbridge", webhookSecret: "secret" });
    await expect(service.me(actor)).resolves.toEqual({ id: "f1", name: "Northbridge" });
  });

  it("aggregates dashboard counts and workload", async () => {
    prisma.firm.findUnique.mockResolvedValue({ id: "f1", name: "Northbridge", webhookSecret: "secret" });
    prisma.user.count.mockResolvedValue(3);
    prisma.client.count.mockResolvedValue(4);
    prisma.vatObligation.count.mockResolvedValue(2);
    prisma.itsaObligation.count.mockResolvedValue(3);
    prisma.user.findMany.mockResolvedValue([{ id: "a1", name: "James Cole", role: UserRole.ACCOUNTANT, status: "ACTIVE" }]);
    prisma.task.findMany.mockResolvedValue([
      { assigneeId: "a1", status: TaskStatus.OPEN },
      { assigneeId: "a1", status: TaskStatus.IN_PROGRESS },
      { assigneeId: null, status: TaskStatus.WAITING_ON_CLIENT },
    ]);
    prisma.task.count.mockResolvedValue(3);
    prisma.bankTransaction.count.mockResolvedValue(7);
    prisma.salesInvoice.count.mockResolvedValue(1);
    prisma.documentFile.count.mockResolvedValue(12);
    prisma.receiptFile.count.mockResolvedValue(5);
    prisma.categorisationSuggestion.count.mockResolvedValue(4);
    prisma.matchingSuggestion.count.mockResolvedValue(2);
    prisma.mtdConnection.count.mockResolvedValue(1);
    prisma.vatObligation.findFirst.mockResolvedValue({
      due: new Date("2026-11-07"),
      periodKey: "26A2",
      client: { name: "Amelia Hartley" },
    });
    prisma.itsaObligation.findFirst.mockResolvedValue({
      due: new Date("2026-11-05"),
      type: "QUARTERLY",
      taxYear: "2026-27",
      client: { name: "Amelia Hartley" },
    });

    const dashboard = await service.dashboard(actor);
    expect(dashboard.staffCount).toBe(3);
    expect(dashboard.clientCount).toBe(4);
    expect(dashboard.openVatObligations).toBe(2);
    expect(dashboard.openItsaObligations).toBe(3);
    expect(dashboard.openObligations).toBe(5);
    expect(dashboard.unmatchedBank).toBe(7);
    expect(dashboard.overdueInvoices).toBe(1);
    expect(dashboard.openTasks).toBe(3);
    expect(dashboard.suggestedCategories).toBe(4);
    expect(dashboard.nextVatDue?.label).toBe("26A2");
    expect(dashboard.taskWorkload).toEqual([
      expect.objectContaining({ name: "James Cole", open: 1, inProgress: 1, waitingOnClient: 0 }),
      expect.objectContaining({ name: "Unassigned", waitingOnClient: 1 }),
    ]);
    expect(prisma.vatObligation.count).toHaveBeenCalledWith({
      where: { status: ObligationStatus.OPEN, client: { firmId: "f1" } },
    });
  });

  it("fails when the firm is missing", async () => {
    prisma.firm.findUnique.mockResolvedValue(null);
    await expect(service.me(actor)).rejects.toBeInstanceOf(NotFoundException);
  });
});
