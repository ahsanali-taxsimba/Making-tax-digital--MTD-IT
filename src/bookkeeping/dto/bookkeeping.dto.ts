import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ChartProfile, JournalSource, LedgerAccountType } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

const toBool = ({ value }: { value: unknown }) => value === true || value === "true";

export class ClientScopedQueryDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profile?: string;
}

export class PeriodQueryDto extends ClientScopedQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional({ description: "UK tax year such as 2025-26" })
  @IsOptional()
  @IsString()
  financialYear?: string;
}

export class CreateChartAccountDto {
  @ApiProperty()
  @IsInt()
  @Min(1000)
  code!: number;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: LedgerAccountType })
  @IsEnum(LedgerAccountType)
  type!: LedgerAccountType;

  @ApiProperty({ enum: ChartProfile })
  @IsEnum(ChartProfile)
  profile!: ChartProfile;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;
}

export class PatchChartAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class JournalLineDto {
  @ApiProperty()
  @IsUUID()
  ledgerAccountId!: string;

  @ApiProperty()
  @IsNumber()
  debit!: number;

  @ApiProperty()
  @IsNumber()
  credit!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taxCodeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateJournalDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiProperty()
  @IsDateString()
  date!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ enum: JournalSource })
  @IsOptional()
  @IsEnum(JournalSource)
  source?: JournalSource;

  @ApiProperty({ type: [JournalLineDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}

export class ListJournalsQueryDto extends PeriodQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;
}

export class CreateBankAccountDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ledgerId?: string;
}

export class ImportBankDto {
  @ApiPropertyOptional({ enum: ["csv", "ofx", "api"] })
  @IsOptional()
  @IsString()
  format?: "csv" | "ofx" | "api";

  @ApiPropertyOptional({ description: "Raw CSV or OFX payload" })
  @IsOptional()
  @IsString()
  payload?: string;

  @ApiPropertyOptional({ type: "array" })
  @IsOptional()
  @IsArray()
  transactions?: Array<{
    date: string;
    amount: number;
    type: "CREDIT" | "DEBIT";
    description: string;
    externalRef?: string;
  }>;
}

export class BankMatchDto {
  @ApiProperty()
  @IsUUID()
  bankTransactionId!: string;

  @ApiProperty()
  @IsUUID()
  journalEntryId!: string;
}

export class BankSplitAllocationDto {
  @ApiProperty()
  @IsUUID()
  ledgerAccountId!: string;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taxCodeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class BankSplitDto {
  @ApiProperty()
  @IsUUID()
  bankTransactionId!: string;

  @ApiProperty({ type: [BankSplitAllocationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankSplitAllocationDto)
  allocations!: BankSplitAllocationDto[];
}

export class ReconcileBankDto {
  @ApiProperty()
  @IsDateString()
  periodStart!: string;

  @ApiProperty()
  @IsDateString()
  periodEnd!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  statementBalance?: number;

  @ApiPropertyOptional({ type: [BankMatchDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankMatchDto)
  matches?: BankMatchDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  ignores?: string[];

  @ApiPropertyOptional({ type: [BankSplitDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankSplitDto)
  splits?: BankSplitDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  autoPostUnmatched?: boolean;
}

export class DocumentLineDto {
  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsNumber()
  net!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taxCodeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ledgerId?: string;
}

export class CreateInvoiceDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiProperty()
  @IsDateString()
  date!: string;

  @ApiProperty()
  @IsDateString()
  dueDate!: string;

  @ApiProperty({ type: [DocumentLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DocumentLineDto)
  lines!: DocumentLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profile?: string;
}

export class CreateBillDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierName?: string;

  @ApiProperty()
  @IsDateString()
  date!: string;

  @ApiProperty()
  @IsDateString()
  dueDate!: string;

  @ApiProperty({ type: [DocumentLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DocumentLineDto)
  lines!: DocumentLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profile?: string;
}

export class VatSummaryQueryDto extends PeriodQueryDto {}

export class ItsaSummaryQueryDto extends PeriodQueryDto {
  @ApiPropertyOptional({ description: "sole_trader | property | landlord | company | all" })
  @IsOptional()
  @IsString()
  businessType?: string;
}

export class CreatePeriodDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiProperty()
  @IsDateString()
  start!: string;

  @ApiProperty()
  @IsDateString()
  end!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  locked?: boolean;
}
