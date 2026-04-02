import { IsOptional, IsString, Length } from 'class-validator';

export class CompleteSupportRequestDto {
  @IsOptional()
  @IsString()
  @Length(0, 4000)
  completionMessage?: string;
}
