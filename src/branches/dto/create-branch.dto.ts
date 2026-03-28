import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @Length(2, 80)
  name: string;

  @IsString()
  @Length(2, 80)
  city: string;

  @IsString()
  @Length(2, 2)
  state: string; // "PR"

  @IsOptional()
  @IsUUID()
  companyId?: string;
}
