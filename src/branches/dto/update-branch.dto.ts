import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  city?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  state?: string;
}

