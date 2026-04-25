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

export enum TripStatusDto {
  DRAFT = 'DRAFT',
  PENDING_COMPLIANCE = 'PENDING_COMPLIANCE',
  BLOCKED = 'BLOCKED',
  APPROVED = 'APPROVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class CreateTripDto {
  @IsString()
  @Length(2, 120)
  origin!: string;

  @IsString()
  @Length(2, 120)
  destination!: string;

  @IsOptional()
  @IsString()
  @Length(2, 300)
  reason?: string;

  @IsNumber()
  @Min(0)
  departureKm!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  returnKm?: number;

  @IsDateString()
  departureAt!: string;

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

  @IsUUID()
  vehicleId!: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;
}
