import { IsEmail } from 'class-validator';

export class ResolveLoginProfileDto {
  @IsEmail()
  email: string;
}
