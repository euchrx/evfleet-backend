import { IsNotEmpty, IsString, Length } from 'class-validator';

export class DeleteCompanyDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 100)
  password: string;

  @IsString()
  @IsNotEmpty()
  confirmationText: string;
}
