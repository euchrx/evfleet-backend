import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { Role } from '@prisma/client';

export { Role };

export class CreateUserDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 100)
  password!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsUUID()
  companyId?: string;
}