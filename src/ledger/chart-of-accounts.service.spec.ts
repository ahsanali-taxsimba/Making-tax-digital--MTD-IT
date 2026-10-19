import { ChartProfile, ClientType, LedgerAccountType } from "@prisma/client";
import { CHART_OF_ACCOUNTS, defaultProfileForClientType, getChart, toLedgerAccountType } from "./chart-of-accounts.catalog";
import { ChartOfAccountsService } from "./chart-of-accounts.service";

describe("chart of accounts catalog", () => {
  it("contains landlord, sole trader, and company profiles", () => {
    expect(CHART_OF_ACCOUNTS.map((item) => item.profile)).toEqual(["landlord", "sole_trader", "company"]);
  });

  it("maps client types onto the right default profile", () => {
    expect(defaultProfileForClientType(ClientType.LANDLORD)).toBe(ChartProfile.LANDLORD);
    expect(defaultProfileForClientType(ClientType.COMPANY)).toBe(ChartProfile.COMPANY);
    expect(defaultProfileForClientType(ClientType.INDIVIDUAL)).toBe(ChartProfile.SOLE_TRADER);
    expect(defaultProfileForClientType(ClientType.PARTNERSHIP)).toBe(ChartProfile.SOLE_TRADER);
  });

  it("maps catalog types onto ledger enums", () => {
    expect(toLedgerAccountType("income")).toBe(LedgerAccountType.INCOME);
    expect(toLedgerAccountType("capital")).toBe(LedgerAccountType.CAPITAL);
    expect(toLedgerAccountType("balance_sheet")).toBe(LedgerAccountType.BALANCE_SHEET);
  });

  it("keeps Section 24 interest on the landlord chart", () => {
    const interest = getChart(ChartProfile.LANDLORD).accounts.find((account) => account.code === 3020);
    expect(interest?.name).toContain("Section 24");
  });

  it("includes sole-trader disallowable codes used by ITSA mapping", () => {
    const codes = getChart(ChartProfile.SOLE_TRADER).accounts.map((account) => account.code);
    expect(codes).toEqual(expect.arrayContaining([4300, 4400]));
  });

  it("adds VAT control accounts to every profile", () => {
    for (const profile of [ChartProfile.LANDLORD, ChartProfile.SOLE_TRADER, ChartProfile.COMPANY]) {
      const codes = getChart(profile).accounts.map((account) => account.code);
      expect(codes).toEqual(expect.arrayContaining([1060, 2200, 2220, 5100, 5110]));
    }
  });
});

describe("ChartOfAccountsService", () => {
  const prisma = {
    ledger: {
      createMany: jest.fn().mockResolvedValue({ count: 26 }),
      findMany: jest.fn().mockResolvedValue([{ code: 1000, profile: ChartProfile.SOLE_TRADER }]),
    },
  };
  const service = new ChartOfAccountsService(prisma as never);

  it("provisions the default profile for a new client", async () => {
    await service.provision("client-1", ClientType.INDIVIDUAL);
    expect(prisma.ledger.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ clientId: "client-1", profile: ChartProfile.SOLE_TRADER, code: 1000 }),
          expect.objectContaining({ clientId: "client-1", profile: ChartProfile.SOLE_TRADER, code: 2200 }),
        ]),
      }),
    );
  });
});
