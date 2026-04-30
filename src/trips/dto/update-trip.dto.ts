import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
} from "class-validator";

export class UpdateTripDto {
  @IsOptional()
  @IsString()
  origin?: string;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsString()
  originState?: string;

  @IsOptional()
  @IsString()
  originCityName?: string;

  @IsOptional()
  @IsString()
  originCityIbgeCode?: string;

  @IsOptional()
  @IsString()
  originZipCode?: string;

  @IsOptional()
  @IsString()
  destinationState?: string;

  @IsOptional()
  @IsString()
  destinationCityName?: string;

  @IsOptional()
  @IsString()
  destinationCityIbgeCode?: string;

  @IsOptional()
  @IsString()
  destinationZipCode?: string;

  // CARGA
  @IsOptional()
  @IsString()
  cargoDescription?: string;

  @IsOptional()
  @IsString()
  cargoNcm?: string;

  @IsOptional()
  @IsNumber()
  cargoValue?: number;

  @IsOptional()
  @IsNumber()
  cargoQuantity?: number;

  @IsOptional()
  @IsString()
  cargoUnit?: "KG" | "TON";

  // PAGAMENTO
  @IsOptional()
  @IsNumber()
  paymentValue?: number;

  @IsOptional()
  @IsString()
  paymentPixKey?: string;

  @IsOptional()
  @IsString()
  paymentIndicator?: "PAID" | "UNPAID";

  @IsOptional()
  @IsString()
  contractorName?: string;

  @IsOptional()
  @IsString()
  contractorDocument?: string;

  // SEGURO
  @IsOptional()
  @IsString()
  insuranceCompanyName?: string;

  @IsOptional()
  @IsString()
  insuranceCompanyDocument?: string;

  @IsOptional()
  @IsString()
  insurancePolicyNumber?: string;

  @IsOptional()
  @IsString()
  insuranceEndorsement?: string;
}