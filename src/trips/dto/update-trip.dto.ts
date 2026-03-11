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
import { TripStatusDto } from './create-trip.dto';

export class UpdateTripDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  origin?: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  destination?: string;

  @IsOptional()
  @IsString()
  @Length(2, 300)
  reason?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  departureKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  returnKm?: number;

  @IsOptional()
  @IsDateString()
  departureAt?: string;

  @IsOptional()
  @IsDateString()
  returnAt?: string;

  @IsOptional()
  @IsEnum(TripStatusDto)
  status?: TripStatusDto;

  @IsOptional()
  @IsString()
  @Length(2, 500)
  notes?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;
}
