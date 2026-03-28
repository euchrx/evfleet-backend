import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateDriverDto {
  @IsString()
  @Length(2, 120)
  name: string;

  @IsString()
  @Length(11, 11)
  cpf: string;

  @IsString()
  @Length(5, 30)
  cnh: string;

  @IsString()
  @Length(1, 5)
  cnhCategory: string;

  @IsDateString()
  cnhExpiresAt: string;

  @IsOptional()
  @IsString()
  @Length(8, 20)
  phone?: string;

  @IsString()
  @Length(2, 30)
  status: string;

  @IsUUID()
  vehicleId: string;
}
