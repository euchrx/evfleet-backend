import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class LinkFuelRecordDto {
  @IsUUID()
  vehicleId: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  km?: number;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

