import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DebtCategoryDto } from '../../debts/dto/create-debt.dto';

export class LinkCostRecordDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsEnum(DebtCategoryDto)
  category?: DebtCategoryDto;
}

