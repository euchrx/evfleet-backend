import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import {
  FuelTypeDto,
  VehicleCategoryDto,
  VehicleStatusDto,
  VehicleTypeDto,
} from './create-vehicle.dto';

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  @Length(7, 8)
  plate?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  model?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  brand?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  year?: number;

  @IsOptional()
  @IsEnum(VehicleTypeDto)
  vehicleType?: VehicleTypeDto;

  @IsOptional()
  @IsEnum(VehicleCategoryDto)
  category?: VehicleCategoryDto;

  @IsOptional()
  @IsString()
  @Length(8, 30)
  chassis?: string;

  @IsOptional()
  @IsString()
  @Length(9, 20)
  renavam?: string;

  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;

  @IsOptional()
  @IsEnum(FuelTypeDto)
  fuelType?: FuelTypeDto;

  @IsOptional()
  @IsNumber()
  @Min(1)
  tankCapacity?: number;

  @IsOptional()
  @IsEnum(VehicleStatusDto)
  status?: VehicleStatusDto;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  photoUrls?: string[];

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  documentUrls?: string[];

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
