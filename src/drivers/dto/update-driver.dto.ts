import { IsDateString, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class UpdateDriverDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(11, 11)
  cpf?: string;

  @IsOptional()
  @IsString()
  @Length(5, 30)
  cnh?: string;

  @IsOptional()
  @IsString()
  @Length(1, 5)
  cnhCategory?: string;

  @IsOptional()
  @IsDateString()
  cnhExpiresAt?: string;

  @IsOptional()
  @IsString()
  @Length(8, 20)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 30)
  status?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string | null;
}

