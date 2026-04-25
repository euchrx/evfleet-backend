import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddTripProductDto {
  @IsString()
  dangerousProductId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsString()
  unit!: string;

  @IsOptional()
  @IsString()
  tankCompartment?: string;

  @IsOptional()
  @IsString()
  invoiceKey?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;
}