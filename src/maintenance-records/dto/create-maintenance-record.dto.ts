import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateMaintenanceRecordDto {
  @IsString()
  @Length(2, 30)
  type: string;

  @IsString()
  @Length(2, 200)
  description: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  partsReplaced?: string[];

  @IsOptional()
  @IsString()
  @Length(2, 120)
  workshop?: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  responsible?: string;

  @IsNumber()
  @Min(0)
  cost: number;

  @IsNumber()
  @Min(0)
  km: number;

  @IsDateString()
  maintenanceDate: string;

  @IsString()
  @Length(2, 30)
  status: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @IsUUID()
  vehicleId: string;
}
