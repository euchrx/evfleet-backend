import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum TireMovementTypeDto {
  MOVE = 'MOVE',
  ROTATION = 'ROTATION',
}

export class CreateTireMovementDto {
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  tireId?: string;

  @IsOptional()
  @IsString()
  secondTireId?: string;

  @IsEnum(TireMovementTypeDto)
  type!: TireMovementTypeDto;

  @IsString()
  tireSerial!: string;

  @IsOptional()
  @IsString()
  secondTireSerial?: string;

  @IsOptional()
  @IsString()
  fromAxle?: string;

  @IsOptional()
  @IsString()
  fromWheel?: string;

  @IsOptional()
  @IsString()
  toAxle?: string;

  @IsOptional()
  @IsString()
  toWheel?: string;

  @IsOptional()
  @IsString()
  note?: string;
}