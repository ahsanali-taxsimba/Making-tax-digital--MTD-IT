import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TaskStatus, TaskType } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, ValidateIf } from "class-validator";

export class CreateTaskDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiProperty({ enum: TaskType })
  @IsEnum(TaskType)
  type!: TaskType;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assigneeId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
}
