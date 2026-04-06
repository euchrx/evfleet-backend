import { IsBoolean } from 'class-validator';

export class UpdateLegalAcceptanceSettingDto {
  @IsBoolean()
  enabled: boolean;
}
