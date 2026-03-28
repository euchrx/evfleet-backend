import { PlanInterval } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 40)
  code: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  name: string;

  @IsOptional()
  @IsString()
  @Length(2, 500)
  description?: string;

  @IsInt()
  @Min(1)
  priceCents: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsEnum(PlanInterval)
  interval: PlanInterval;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
