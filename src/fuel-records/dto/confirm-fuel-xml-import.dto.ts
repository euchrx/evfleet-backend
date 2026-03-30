import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class ConfirmFuelXmlImportItemDto {
  @IsString()
  @Length(10, 80)
  invoiceKey: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  km?: number;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class ConfirmFuelXmlImportDto {
  @IsArray()
  @ArrayMinSize(1)
  imports: ConfirmFuelXmlImportItemDto[];
}

