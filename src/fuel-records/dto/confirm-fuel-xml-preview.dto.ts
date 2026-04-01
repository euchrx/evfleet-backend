import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ConfirmFuelXmlPreviewItemDto {
  @IsBoolean()
  selected: boolean;

  @IsNumber()
  @Min(1)
  lineIndex: number;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  productCode?: string;

  @IsString()
  @Length(1, 200)
  productName: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsNumber()
  @Min(0)
  totalPrice: number;

  @IsIn(['FUEL', 'ARLA', 'OTHER'])
  detectedType: 'FUEL' | 'ARLA' | 'OTHER';

  @IsBoolean()
  importable: boolean;

  @IsBoolean()
  duplicate: boolean;

  @IsOptional()
  @IsString()
  duplicateReason?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  detectedFuelType?: string;

  @IsOptional()
  @IsDateString()
  fuelDateTime?: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  nozzleNumber?: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  pumpNumber?: string;
}

class ConfirmFuelXmlPreviewInvoiceDto {
  @IsString()
  @Length(20, 80)
  invoiceKey: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  invoiceNumber?: string;

  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  supplierName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  supplierDocument?: string;

  @IsOptional()
  @IsString()
  @Length(1, 10)
  plate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  odometer?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConfirmFuelXmlPreviewItemDto)
  items: ConfirmFuelXmlPreviewItemDto[];
}

export class ConfirmFuelXmlPreviewDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConfirmFuelXmlPreviewInvoiceDto)
  invoices: ConfirmFuelXmlPreviewInvoiceDto[];
}
