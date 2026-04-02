import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class RespondSupportRequestDto {
  @IsString()
  @Length(5, 4000)
  responseMessage: string;

  @IsOptional()
  @IsDateString()
  estimatedCompletionAt?: string;
}
