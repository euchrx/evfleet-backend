import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { DebtCategoryDto } from './create-debt.dto';

export class UpdateDebtDto {
  @IsOptional()
  @IsString()
  @Length(2, 200)
  description?: string;

  @IsOptional()
  @IsEnum(DebtCategoryDto)
  category?: DebtCategoryDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  points?: number;

  @IsOptional()
  @IsDateString()
  debtDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @Length(2, 15)
  referenceMonth?: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  creditor?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsString()
  @Length(2, 30)
  status?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}
