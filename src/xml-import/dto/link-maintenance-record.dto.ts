import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class LinkMaintenanceRecordDto {
  @IsUUID()
  vehicleId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @Length(2, 300)
  descriptionComplement?: string;
}

