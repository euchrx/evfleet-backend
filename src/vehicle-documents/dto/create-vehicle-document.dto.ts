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
  CNH = 'CNH',
  EAR = 'EAR',
  MOPP = 'MOPP',
  TOXICOLOGICAL_EXAM = 'TOXICOLOGICAL_EXAM',
  EMPLOYMENT_RECORD = 'EMPLOYMENT_RECORD',
  RG = 'RG',
  CPF_DOCUMENT = 'CPF_DOCUMENT',
  DEFENSIVE_DRIVING = 'DEFENSIVE_DRIVING',
  TRUCAO_TRANSPORTE = 'TRUCAO_TRANSPORTE',
  CRLV = 'CRLV',
  CIV = 'CIV',
  CIPP = 'CIPP',
  ENVIRONMENTAL_AUTHORIZATION = 'ENVIRONMENTAL_AUTHORIZATION',
  RNTRC = 'RNTRC',
  OTHER = 'OTHER',
}

export enum DocumentOwnerTypeDto {
  VEHICLE = 'VEHICLE',
  DRIVER = 'DRIVER',
  GENERAL = 'GENERAL',
}

export enum DocumentStatusDto {
  VALID = 'VALID',
  EXPIRING = 'EXPIRING',
  EXPIRED = 'EXPIRED',
}

export class CreateVehicleDocumentDto {
  @IsEnum(VehicleDocumentTypeDto)
  type: VehicleDocumentTypeDto;

  @IsOptional()
  @IsEnum(DocumentOwnerTypeDto)
  ownerType?: DocumentOwnerTypeDto;

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

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;
}
