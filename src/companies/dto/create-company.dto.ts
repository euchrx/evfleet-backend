import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  name: string;

  @IsOptional()
  @IsString()
  @Length(3, 30)
  document?: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  slug?: string;
}
