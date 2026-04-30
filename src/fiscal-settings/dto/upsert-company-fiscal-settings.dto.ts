import { IsEnum, IsNumber, IsOptional, IsString } from "class-validator";

export enum FiscalEnvironment {
  HOMOLOGATION = "HOMOLOGATION",
  PRODUCTION = "PRODUCTION",
}

export class UpsertCompanyFiscalSettingsDto {
  @IsString()
  cnpj!: string;

  @IsString()
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
  state!: string;

  @IsString()
  zipCode!: string;

  @IsOptional()
  @IsString()
  rntrc?: string;

  @IsEnum(FiscalEnvironment)
  mdfeEnvironment!: FiscalEnvironment;

  @IsNumber()
  mdfeSeries!: number;

  @IsNumber()
  mdfeNextNumber!: number;

  @IsOptional()
  @IsString()
  mdfeDefaultInsurerName?: string;

  @IsOptional()
  @IsString()
  mdfeDefaultInsurerDocument?: string;

  @IsOptional()
  @IsString()
  mdfeDefaultPolicyNumber?: string;

  @IsOptional()
  @IsString()
  certificatePfxUrl?: string;

  @IsOptional()
  @IsString()
  certificatePasswordEncrypted?: string;

  @IsOptional()
  @IsString()
  certificateExpiresAt?: string;
}