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

export enum VehicleTypeDto {
  LIGHT = 'LIGHT',
  HEAVY = 'HEAVY',
}

export enum VehicleCategoryDto {
  CAR = 'CAR',
  TRUCK = 'TRUCK',
  UTILITY = 'UTILITY',
  IMPLEMENT = 'IMPLEMENT',
}

export enum FuelTypeDto {
  GASOLINE = 'GASOLINE',
  ETHANOL = 'ETHANOL',
  DIESEL = 'DIESEL',
  ARLA32 = 'ARLA32',
  FLEX = 'FLEX',
  ELECTRIC = 'ELECTRIC',
  HYBRID = 'HYBRID',
  CNG = 'CNG',
}

export enum VehicleStatusDto {
  ACTIVE = 'ACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  SOLD = 'SOLD',
}

export class CreateVehicleDto {
  @IsString()
  @Length(7, 8)
  plate: string;

  @IsString()
  @Length(1, 80)
  model: string;

  @IsString()
  @Length(1, 80)
  brand: string;

  @IsInt()
  @Min(1900)
  year: number;

  @IsEnum(VehicleTypeDto)
  vehicleType: VehicleTypeDto;

  @IsEnum(VehicleCategoryDto)
  category: VehicleCategoryDto;

  @IsString()
  @Length(8, 30)
  chassis: string;

  @IsString()
  @Length(9, 20)
  renavam: string;

  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;

  @IsEnum(FuelTypeDto)
  fuelType: FuelTypeDto;

  @IsNumber()
  @Min(1)
  tankCapacity: number;

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
