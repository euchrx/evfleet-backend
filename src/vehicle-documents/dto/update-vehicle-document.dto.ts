import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import {
  DocumentOwnerTypeDto,
  DocumentStatusDto,
  VehicleDocumentTypeDto,
} from './create-vehicle-document.dto';

export class UpdateVehicleDocumentDto {
  @IsOptional()
  @IsEnum(VehicleDocumentTypeDto)
  type?: VehicleDocumentTypeDto;

  @IsOptional()
  @IsEnum(DocumentOwnerTypeDto)
  ownerType?: DocumentOwnerTypeDto;

  @IsOptional()
  @IsString()
  @Length(2, 140)
  name?: string;

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
