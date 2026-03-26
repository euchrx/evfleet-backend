import { Body, Controller, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { SystemResetService } from './system-reset.service';
import { ResetAllDto } from './dto/reset-all.dto';

@Controller('system-reset')
export class SystemResetController {
  constructor(private readonly service: SystemResetService) {}

  @Post('all')
  @Roles('ADMIN')
  async resetAll(@Body() dto: ResetAllDto) {
    return this.service.resetAllDatabase(dto.jwtSecretToken);
  }
}
