import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export enum VehicleDocumentTypeDto {
  LICENSING = 'LICENSING',
  INSURANCE = 'INSURANCE',
  IPVA = 'IPVA',
  LEASING_CONTRACT = 'LEASING_CONTRACT',
  INSPECTION = 'INSPECTION',
  OTHER = 'OTHER',
}

export enum DocumentStatusDto {
  VALID = 'VALID',
  EXPIRING = 'EXPIRING',
  EXPIRED = 'EXPIRED',
}

export class CreateVehicleDocumentDto {
  @IsEnum(VehicleDocumentTypeDto)
  type: VehicleDocumentTypeDto;

  @IsString()
  @Length(2, 140)
  name: string;

  @IsOptional()
  @IsString()
  @Length(2, 60)
  number?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsEnum(DocumentStatusDto)
  status?: DocumentStatusDto;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  issuer?: string;

  @IsOptional()
  @IsString()
  @Length(2, 600)
  notes?: string;

  @IsOptional()
  @IsString()
  @Length(2, 300)
  fileUrl?: string;

  @IsUUID()
  vehicleId: string;
}
