import { Body, Controller, Get, Put } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { UpdateMenuVisibilityDto } from './dto/update-menu-visibility.dto';
import { MenuVisibilityService } from './menu-visibility.service';

@Controller('menu-visibility')
export class MenuVisibilityController {
  constructor(private readonly service: MenuVisibilityService) {}

  @Get()
  async getVisibility() {
    const visibility = await this.service.getVisibility();
    return { visibility };
  }

  @Put()
  @Roles('ADMIN')
  async updateVisibility(@Body() dto: UpdateMenuVisibilityDto) {
    const visibility = await this.service.updateVisibility(dto.visibility);
    return { visibility };
  }
}

