import { IsEmail, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { Role } from './create-user.dto';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(6, 100)
  password?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
