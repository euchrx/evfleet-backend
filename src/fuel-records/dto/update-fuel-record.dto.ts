import {
  IsEnum,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { FuelTypeDto } from '../../vehicles/dto/create-vehicle.dto';

export class UpdateFuelRecordDto {
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  liters?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  totalValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  km?: number;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  station?: string;

  @IsOptional()
  @IsDateString()
  fuelDate?: string;

  @IsOptional()
  @IsEnum(FuelTypeDto)
  fuelType?: FuelTypeDto;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}
