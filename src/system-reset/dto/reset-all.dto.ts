import { IsNotEmpty, IsString } from 'class-validator';

export class ResetAllDto {
  @IsString()
  @IsNotEmpty()
  jwtSecretToken: string;
}

