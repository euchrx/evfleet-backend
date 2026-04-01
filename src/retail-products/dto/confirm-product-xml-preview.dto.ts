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

class ConfirmProductXmlPreviewItemDto {
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

  @IsIn(['PRODUCT'])
  detectedType: 'PRODUCT';

  @IsBoolean()
  importable: boolean;

  @IsBoolean()
  duplicate: boolean;

  @IsOptional()
  @IsString()
  duplicateReason?: string | null;

  @IsString()
  @Length(1, 40)
  category: string;
}

class ConfirmProductXmlPreviewInvoiceDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  fileName?: string;

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmProductXmlPreviewItemDto)
  items: ConfirmProductXmlPreviewItemDto[];
}

export class ConfirmProductXmlPreviewDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConfirmProductXmlPreviewInvoiceDto)
  invoices: ConfirmProductXmlPreviewInvoiceDto[];
}
