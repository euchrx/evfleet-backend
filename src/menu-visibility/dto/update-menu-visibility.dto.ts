import { IsObject } from 'class-validator';

export class UpdateMenuVisibilityDto {
  @IsObject()
  visibility!: Record<string, boolean>;
}

