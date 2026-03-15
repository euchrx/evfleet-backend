import { Module } from '@nestjs/common';
import { MenuVisibilityController } from './menu-visibility.controller';
import { MenuVisibilityService } from './menu-visibility.service';

@Module({
  controllers: [MenuVisibilityController],
  providers: [MenuVisibilityService],
})
export class MenuVisibilityModule {}

