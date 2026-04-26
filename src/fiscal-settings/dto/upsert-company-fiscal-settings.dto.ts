import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { FiscalEnvironment } from '@prisma/client';

export class UpsertCompanyFiscalSettingsDto {
  @IsString()
  @MinLength(14)
  @MaxLength(14)
  cnpj!: string;

  @IsString()
  @MinLength(2)
  corporateName!: string;

  @IsOptional()
  @IsString()
  tradeName?: string;

  @IsOptional()
  @IsString()
  stateRegistration?: string;

  @IsOptional()
  @IsString()
  taxRegime?: string;

  @IsString()
  addressStreet!: string;

  @IsString()
  addressNumber!: string;

  @IsString()
  addressDistrict!: string;

  @IsOptional()
  @IsString()
  addressComplement?: string;

  @IsString()
  cityName!: string;

  @IsString()
  cityIbgeCode!: string;

  @IsString()
  @MaxLength(2)
  state!: string;

  @IsString()
  zipCode!: string;

  @IsEnum(FiscalEnvironment)
  mdfeEnvironment!: FiscalEnvironment;

  @IsInt()
  @Min(1)
  mdfeSeries!: number;

  @IsInt()
  @Min(1)
  mdfeNextNumber!: number;

  @IsOptional()
  @IsString()
  certificatePfxUrl?: string;

  @IsOptional()
  @IsString()
  certificatePasswordEncrypted?: string;

  @IsOptional()
  @IsDateString()
  certificateExpiresAt?: string;
}