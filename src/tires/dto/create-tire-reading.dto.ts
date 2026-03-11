import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateTireReadingDto {
  @IsDateString()
  readingDate: string;

  @IsNumber()
  @Min(0)
  km: number;

  @IsNumber()
  @Min(0)
  treadDepthMm: number;

  @IsNumber()
  @Min(0)
  pressurePsi: number;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  condition?: string;

  @IsOptional()
  @IsString()
  @Length(2, 500)
  notes?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}
