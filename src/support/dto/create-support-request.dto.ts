import { SupportRequestCategory } from '@prisma/client';
import { IsEnum, IsString, Length } from 'class-validator';

export class CreateSupportRequestDto {
  @IsString()
  @Length(3, 120)
  title: string;

  @IsString()
  @Length(10, 4000)
  description: string;

  @IsEnum(SupportRequestCategory)
  category: SupportRequestCategory;
}
