import { Controller, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { SystemResetService } from './system-reset.service';

@Controller('system-reset')
export class SystemResetController {
  constructor(private readonly service: SystemResetService) {}

  @Post('all')
  @Roles('ADMIN')
  async resetAll() {
    return this.service.resetAllDatabase();
  }
}

