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

export enum DebtCategoryDto {
  FINE = 'FINE',
  IPVA = 'IPVA',
  LICENSING = 'LICENSING',
  INSURANCE = 'INSURANCE',
  TOLL = 'TOLL',
  TAX = 'TAX',
  OTHER = 'OTHER',
}

export class CreateDebtDto {
  @IsString()
  @Length(2, 200)
  description: string;

  @IsOptional()
  @IsEnum(DebtCategoryDto)
  category?: DebtCategoryDto;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  points?: number;

  @IsDateString()
  debtDate: string;

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

  @IsString()
  @Length(2, 30)
  status: string;

  @IsUUID()
  vehicleId: string;
}
