import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { MdfeService } from './mdfe.service';

type AuthenticatedRequest = {
  companyScopeId?: string | null;
  user?: {
    userId?: string;
    email?: string;
    role?: string;
    companyId?: string | null;
  };
};

type CancelMdfeBody = {
  reason?: string;
};

@UseGuards(JwtAuthGuard)
@Controller('trips/:tripId/mdfe')
export class MdfeController {
  constructor(private readonly mdfeService: MdfeService) { }

  private getCompanyId(req: AuthenticatedRequest) {
    const companyId = req?.companyScopeId || req?.user?.companyId || null;

    if (!companyId) {
      throw new BadRequestException('Usuário sem empresa vinculada.');
    }

    return companyId;
  }

  @Get()
  getByTrip(@Param('tripId') tripId: string, @Req() req: AuthenticatedRequest) {
    return this.mdfeService.getByTrip(tripId, this.getCompanyId(req));
  }

  @Get('xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async downloadXml(
    @Param('tripId') tripId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const file = await this.mdfeService.getXmlByTrip(
      tripId,
      this.getCompanyId(req),
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );

    return res.send(file.xml);
  }

  @Get('damdfe')
  async downloadDamdfe(
    @Param('tripId') tripId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const file = await this.mdfeService.getDamdfeByTrip(
      tripId,
      this.getCompanyId(req),
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );

    return res.send(file.buffer);
  }

  @Post('consult')
  consult(@Param('tripId') tripId: string, @Req() req: AuthenticatedRequest) {
    console.log('CONSULT MDFE CHAMADO:', {
      tripId,
      companyId: this.getCompanyId(req),
    });

    return this.mdfeService.consult(tripId, this.getCompanyId(req));
  }

  @Post('close')
  close(@Param('tripId') tripId: string, @Req() req: AuthenticatedRequest) {
    return this.mdfeService.close(tripId, this.getCompanyId(req));
  }

  @Post('cancel')
  cancel(
    @Param('tripId') tripId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: CancelMdfeBody,
  ) {
    return this.mdfeService.cancel(
      tripId,
      this.getCompanyId(req),
      body.reason ?? '',
    );
  }
}