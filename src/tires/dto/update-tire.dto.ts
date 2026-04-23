import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TireStatusDto } from './create-tire.dto';

export class UpdateTireDto {
  @IsOptional()
  @IsString()
  @Length(4, 80)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @Length(2, 40)
  brand?: string;

  @IsOptional()
  @IsString()
  @Length(2, 60)
  model?: string;

  @IsOptional()
  @IsString()
  @Length(2, 40)
  size?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'O aro deve ser um número válido.' })
  @Min(1)
  rim?: number;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchaseCost?: number;

  @IsOptional()
  @IsEnum(TireStatusDto)
  status?: TireStatusDto;

  @IsOptional()
  @IsString()
  @Length(2, 50)
  axlePosition?: string;

  @IsOptional()
  @IsString()
  @Length(2, 50)
  wheelPosition?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentTreadDepthMm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentPressurePsi?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetPressurePsi?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minTreadDepthMm?: number;

  @IsOptional()
  @IsDateString()
  installedAt?: string;

  @IsOptional()
  @IsString()
  @Length(2, 500)
  notes?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}
