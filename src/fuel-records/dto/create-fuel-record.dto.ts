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

export class CreateFuelRecordDto {
  @IsNumber()
  @Min(0.0001)
  liters: number;

  @IsNumber()
  @Min(0.01)
  totalValue: number;

  @IsNumber()
  @Min(0)
  km: number;

  @IsString()
  @Length(2, 120)
  station: string;

  @IsDateString()
  fuelDate: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  invoiceNumber?: string;

  @IsEnum(FuelTypeDto)
  fuelType: FuelTypeDto;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsUUID()
  vehicleId: string;
}
