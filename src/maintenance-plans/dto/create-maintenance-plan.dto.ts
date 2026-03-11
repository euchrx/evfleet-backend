import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateMaintenancePlanDto {
  @IsString()
  @Length(2, 120)
  name: string;

  @IsString()
  @Length(2, 30)
  planType: string;

  @IsString()
  @Length(2, 20)
  intervalUnit: string;

  @IsInt()
  @Min(1)
  intervalValue: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  alertBeforeKm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  alertBeforeDays?: number;

  @IsOptional()
  @IsDateString()
  nextDueDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  nextDueKm?: number;

  @IsOptional()
  @IsDateString()
  lastExecutedDate?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @IsUUID()
  vehicleId: string;
}
