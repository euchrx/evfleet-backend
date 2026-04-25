import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type { Prisma } from '@prisma/client';

export class CreateDangerousProductDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  commercialName?: string;

  @IsString()
  @MinLength(1)
  unNumber!: string;

  @IsString()
  @MinLength(1)
  riskClass!: string;

  @IsOptional()
  @IsString()
  packingGroup?: string;

  @IsOptional()
  @IsString()
  hazardNumber?: string;

  @IsOptional()
  @IsString()
  emergencyNumber?: string;

  @IsOptional()
  @IsString()
  physicalState?: string;

  @IsOptional()
  @IsObject()
  emergencyInstructions?: Prisma.InputJsonObject;

  @IsString()
  @MinLength(1, {
    message: 'FISPQ é obrigatória para cadastrar produto perigoso.',
  })
  fispqUrl!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}