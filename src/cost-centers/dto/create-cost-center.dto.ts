import { IsString, Length } from 'class-validator';

export class CreateCostCenterDto {
  @IsString()
  @Length(2, 80)
  name: string;
}