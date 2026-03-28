import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export enum Role {
  ADMIN = 'ADMIN',
  FLEET_MANAGER = 'FLEET_MANAGER',
  REGIONAL_MANAGER = 'REGIONAL_MANAGER',
  BRANCH_MANAGER = 'BRANCH_MANAGER',
}

export class CreateUserDto {
  @IsString()
  @Length(2, 80)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 100)
  password: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsUUID()
  companyId?: string;
}

