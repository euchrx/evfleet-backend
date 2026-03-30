import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class ImportXmlZipDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  periodLabel?: string;
}

