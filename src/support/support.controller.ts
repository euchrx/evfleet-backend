import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { CompleteSupportRequestDto } from './dto/complete-support-request.dto';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { RespondSupportRequestDto } from './dto/respond-support-request.dto';
import { SupportService } from './support.service';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('requests')
  listRequests(@Req() req: any) {
    return this.supportService.listRequests(this.buildContext(req));
  }

  @Post('requests')
  createRequest(@Req() req: any, @Body() dto: CreateSupportRequestDto) {
    return this.supportService.createRequest(this.buildContext(req), dto);
  }

  @Patch('requests/:id/respond')
  respondRequest(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: RespondSupportRequestDto,
  ) {
    return this.supportService.respondRequest(id, this.buildContext(req), dto);
  }

  @Patch('requests/:id/complete')
  completeRequest(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: CompleteSupportRequestDto,
  ) {
    return this.supportService.completeRequest(id, this.buildContext(req), dto);
  }

  private buildContext(req: any) {
    return {
      userId: req?.user?.userId || req?.user?.id || null,
      role: req?.user?.role || null,
      companyId: req?.user?.companyId || null,
      companyScopeId: req?.companyScopeId || null,
    };
  }
}
