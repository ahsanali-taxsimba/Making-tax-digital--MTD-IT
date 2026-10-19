import { ChartProfile, ClientType, LedgerAccountType } from "@prisma/client";
import { VAT_LEDGER_ACCOUNTS } from "../vat/vat-box.mapping";

export type ChartAccountType = "income" | "expense" | "capital" | "balance_sheet";

export interface ChartAccountDefinition {
  code: number;
  name: string;
  category: string;
  type: ChartAccountType;
}

export interface ChartOfAccountsDefinition {
  profile: "landlord" | "sole_trader" | "company";
  accounts: ChartAccountDefinition[];
}

export const CHART_OF_ACCOUNTS: ChartOfAccountsDefinition[] = [
  {
    profile: "landlord",
    accounts: [
      { code: 2000, name: "Residential Rent Received", category: "Income", type: "income" },
      { code: 2010, name: "Commercial Rent Received", category: "Income", type: "income" },
      { code: 2020, name: "Holiday Let Income", category: "Income", type: "income" },
      { code: 2030, name: "Service Charges / Ground Rent Income", category: "Income", type: "income" },
      { code: 2050, name: "Other Property Income", category: "Income", type: "income" },
      { code: 3000, name: "Repairs & Maintenance", category: "Allowable Expenses", type: "expense" },
      { code: 3010, name: "Property Insurance", category: "Allowable Expenses", type: "expense" },
      { code: 3020, name: "Loan Interest (Section 24)", category: "Allowable Expenses", type: "expense" },
      { code: 3030, name: "Agent & Management Fees", category: "Allowable Expenses", type: "expense" },
      { code: 3040, name: "Service Charges Paid", category: "Allowable Expenses", type: "expense" },
      { code: 3050, name: "Utilities (Landlord Paid)", category: "Allowable Expenses", type: "expense" },
      { code: 3060, name: "Council Tax (Landlord Paid)", category: "Allowable Expenses", type: "expense" },
      { code: 3070, name: "Ground Rent", category: "Allowable Expenses", type: "expense" },
      { code: 3080, name: "Cleaning & Gardening", category: "Allowable Expenses", type: "expense" },
      { code: 3090, name: "Safety Certificates (Gas/EICR)", category: "Allowable Expenses", type: "expense" },
      { code: 3100, name: "Advertising for Tenants", category: "Allowable Expenses", type: "expense" },
      { code: 3110, name: "Legal Fees (Allowable)", category: "Allowable Expenses", type: "expense" },
      { code: 3120, name: "Accountancy Fees", category: "Allowable Expenses", type: "expense" },
      { code: 3130, name: "Travel for Property Management", category: "Allowable Expenses", type: "expense" },
      { code: 3140, name: "Replacement Domestic Items Relief", category: "Allowable Expenses", type: "expense" },
      { code: 4000, name: "Capital Improvements", category: "Capital", type: "capital" },
      { code: 4010, name: "Fixtures & Fittings (Capital)", category: "Capital", type: "capital" },
      { code: 4020, name: "Property Purchase Costs", category: "Capital", type: "capital" },
      ...VAT_LEDGER_ACCOUNTS,
    ],
  },
  {
    profile: "sole_trader",
    accounts: [
      { code: 1000, name: "Sales / Turnover", category: "Income", type: "income" },
      { code: 1010, name: "Cash Sales", category: "Income", type: "income" },
      { code: 1020, name: "Online Sales", category: "Income", type: "income" },
      { code: 1040, name: "Other Business Income", category: "Income", type: "income" },
      { code: 2000, name: "Cost of Goods Sold", category: "Direct Costs", type: "expense" },
      { code: 2010, name: "Materials Purchased", category: "Direct Costs", type: "expense" },
      { code: 2020, name: "Subcontractor Costs (CIS)", category: "Direct Costs", type: "expense" },
      { code: 2030, name: "Direct Labour", category: "Direct Costs", type: "expense" },
      { code: 3000, name: "Advertising & Marketing", category: "Expenses", type: "expense" },
      { code: 3010, name: "Bank Charges", category: "Expenses", type: "expense" },
      { code: 3020, name: "Business Insurance", category: "Expenses", type: "expense" },
      { code: 3030, name: "Computer & Software", category: "Expenses", type: "expense" },
      { code: 3040, name: "Telephone & Internet", category: "Expenses", type: "expense" },
      { code: 3050, name: "Office Supplies", category: "Expenses", type: "expense" },
      { code: 3060, name: "Rent of Premises", category: "Expenses", type: "expense" },
      { code: 3070, name: "Repairs & Maintenance", category: "Expenses", type: "expense" },
      { code: 3080, name: "Motor Expenses", category: "Expenses", type: "expense" },
      { code: 3090, name: "Travel & Subsistence", category: "Expenses", type: "expense" },
      { code: 3100, name: "Professional Fees", category: "Expenses", type: "expense" },
      { code: 3110, name: "Staff Wages", category: "Expenses", type: "expense" },
      { code: 3120, name: "Employer NI", category: "Expenses", type: "expense" },
      { code: 3130, name: "Pension Contributions", category: "Expenses", type: "expense" },
      { code: 3140, name: "Training & Courses", category: "Expenses", type: "expense" },
      { code: 3150, name: "Subscriptions", category: "Expenses", type: "expense" },
      { code: 4300, name: "Non-allowable Entertainment", category: "Disallowable", type: "expense" },
      { code: 4400, name: "Non-allowable General Expenses", category: "Disallowable", type: "expense" },
      { code: 4000, name: "Equipment (Capital)", category: "Capital", type: "capital" },
      { code: 4010, name: "Vehicles (Capital)", category: "Capital", type: "capital" },
      { code: 4020, name: "Tools & Machinery", category: "Capital", type: "capital" },
      ...VAT_LEDGER_ACCOUNTS,
    ],
  },
  {
    profile: "company",
    accounts: [
      { code: 1000, name: "Sales Revenue", category: "Income", type: "income" },
      { code: 1010, name: "Service Income", category: "Income", type: "income" },
      { code: 1020, name: "Rental Income", category: "Income", type: "income" },
      { code: 1030, name: "Interest Income", category: "Income", type: "income" },
      { code: 2000, name: "Purchases", category: "Cost of Sales", type: "expense" },
      { code: 2010, name: "Direct Labour", category: "Cost of Sales", type: "expense" },
      { code: 2020, name: "Subcontractors (CIS)", category: "Cost of Sales", type: "expense" },
      { code: 3000, name: "Advertising & Marketing", category: "Operating Expenses", type: "expense" },
      { code: 3010, name: "Bank Charges", category: "Operating Expenses", type: "expense" },
      { code: 3020, name: "Insurance", category: "Operating Expenses", type: "expense" },
      { code: 3030, name: "Computer & IT Costs", category: "Operating Expenses", type: "expense" },
      { code: 3040, name: "Office Rent", category: "Operating Expenses", type: "expense" },
      { code: 3050, name: "Utilities", category: "Operating Expenses", type: "expense" },
      { code: 3060, name: "Repairs & Maintenance", category: "Operating Expenses", type: "expense" },
      { code: 3070, name: "Motor Expenses", category: "Operating Expenses", type: "expense" },
      { code: 3080, name: "Travel & Accommodation", category: "Operating Expenses", type: "expense" },
      { code: 3090, name: "Professional Fees", category: "Operating Expenses", type: "expense" },
      { code: 3100, name: "Wages & Salaries", category: "Operating Expenses", type: "expense" },
      { code: 3110, name: "Employer NI", category: "Operating Expenses", type: "expense" },
      { code: 3120, name: "Pension Contributions", category: "Operating Expenses", type: "expense" },
      { code: 4000, name: "Fixed Assets", category: "Balance Sheet", type: "balance_sheet" },
      { code: 4100, name: "Accumulated Depreciation", category: "Balance Sheet", type: "balance_sheet" },
      { code: 4200, name: "Debtors", category: "Balance Sheet", type: "balance_sheet" },
      { code: 4300, name: "Creditors", category: "Balance Sheet", type: "balance_sheet" },
      { code: 4400, name: "VAT Control", category: "Balance Sheet", type: "balance_sheet" },
      { code: 4500, name: "PAYE/NI Control", category: "Balance Sheet", type: "balance_sheet" },
      { code: 4600, name: "Corporation Tax Liability", category: "Balance Sheet", type: "balance_sheet" },
      { code: 4700, name: "Directors Loan Account", category: "Balance Sheet", type: "balance_sheet" },
      ...VAT_LEDGER_ACCOUNTS,
    ],
  },
];

export function toChartProfile(value: string): ChartProfile {
  switch (value.toLowerCase()) {
    case "landlord":
      return ChartProfile.LANDLORD;
    case "company":
      return ChartProfile.COMPANY;
    default:
      return ChartProfile.SOLE_TRADER;
  }
}

export function profileKey(profile: ChartProfile): ChartOfAccountsDefinition["profile"] {
  switch (profile) {
    case ChartProfile.LANDLORD:
      return "landlord";
    case ChartProfile.COMPANY:
      return "company";
    default:
      return "sole_trader";
  }
}

export function defaultProfileForClientType(type: ClientType): ChartProfile {
  switch (type) {
    case ClientType.LANDLORD:
      return ChartProfile.LANDLORD;
    case ClientType.COMPANY:
      return ChartProfile.COMPANY;
    default:
      return ChartProfile.SOLE_TRADER;
  }
}

export function toLedgerAccountType(type: ChartAccountType): LedgerAccountType {
  switch (type) {
    case "income":
      return LedgerAccountType.INCOME;
    case "expense":
      return LedgerAccountType.EXPENSE;
    case "capital":
      return LedgerAccountType.CAPITAL;
    case "balance_sheet":
      return LedgerAccountType.BALANCE_SHEET;
  }
}

export function getChart(profile: ChartProfile): ChartOfAccountsDefinition {
  const key = profileKey(profile);
  const chart = CHART_OF_ACCOUNTS.find((item) => item.profile === key);
  if (!chart) {
    throw new Error(`Unknown chart profile ${profile}`);
  }
  return chart;
}
