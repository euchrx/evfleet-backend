import { Body, Controller, Get, Put } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { UpdateLegalAcceptanceSettingDto } from './dto/update-legal-acceptance-setting.dto';
import { SystemSettingsService } from './system-settings.service';

@Controller('system-settings')
export class SystemSettingsController {
  constructor(private readonly service: SystemSettingsService) {}

  @Get('legal-acceptance')
  async getLegalAcceptanceSettings() {
    return this.service.getLegalAcceptanceSettings();
  }

  @Put('legal-acceptance')
  @Roles('ADMIN')
  async updateLegalAcceptanceSettings(
    @Body() dto: UpdateLegalAcceptanceSettingDto,
  ) {
    return this.service.updateLegalAcceptanceSettings(dto.enabled);
  }
}
