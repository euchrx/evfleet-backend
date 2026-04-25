import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ComplianceRule, ComplianceRuleResult } from './rules/compliance-rule.interface';
import { DriverMoppRule } from './rules/driver-mopp.rule';
import { VehicleCippRule } from './rules/vehicle-cipp.rule';
import { VehicleCivRule } from './rules/vehicle-civ.rule';
import { VehicleCrlvRule } from './rules/vehicle-crlv.rule';
import { ProductFispqRule } from './rules/product-fispq.rule';
import { GeneratedDocumentsRule } from './rules/generated-documents.rule';

@Injectable()
export class ComplianceService {

  private readonly generatedDocumentsRule = new GeneratedDocumentsRule();

  constructor(
    private readonly prisma: PrismaService,
    private readonly driverMoppRule: DriverMoppRule,
    private readonly vehicleCippRule: VehicleCippRule,
    private readonly vehicleCivRule: VehicleCivRule,
    private readonly vehicleCrlvRule: VehicleCrlvRule,
    private readonly productFispqRule: ProductFispqRule,
  ) { }

  private get rules(): ComplianceRule[] {
    return [
      this.driverMoppRule,
      this.vehicleCippRule,
      this.vehicleCivRule,
      this.vehicleCrlvRule,
      this.productFispqRule,
      this.generatedDocumentsRule,
    ];
  }

  async validateTrip(tripId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        vehicle: true,
        driver: true,
        products: {
          include: {
            dangerousProduct: true,
          },
        },
        generatedDocuments: {
          select: {
            type: true,
            status: true,
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Viagem não encontrada.');
    }

    const documents = await this.prisma.vehicleDocument.findMany({
      where: {
        OR: [
          { vehicleId: trip.vehicleId },
          trip.driverId ? { driverId: trip.driverId } : undefined,
          trip.companyId ? { companyId: trip.companyId, ownerType: 'GENERAL' } : undefined,
        ].filter(Boolean) as any,
      },
    });

    const results = await Promise.all(
      this.rules.map((rule) =>
        rule.validate({
          trip,
          vehicle: trip.vehicle,
          driver: trip.driver,
          products: trip.products,
          documents,
          generatedDocuments: trip.generatedDocuments,
        }),
      ),
    );

    const hasBlocking = results.some(
      (result) => !result.passed && result.severity === 'BLOCKING',
    );

    const hasWarning = results.some(
      (result) => !result.passed && result.severity === 'WARNING',
    );

    const status = hasBlocking ? 'BLOCKED' : hasWarning ? 'WARNING' : 'APPROVED';

    const check = await this.prisma.tripComplianceCheck.create({
      data: {
        tripId,
        status,
        summary:
          status === 'APPROVED'
            ? 'Viagem aprovada para liberação.'
            : status === 'WARNING'
              ? 'Viagem aprovada com alertas.'
              : 'Viagem bloqueada por pendências obrigatórias.',
        results: {
          create: results.map((result: ComplianceRuleResult) => ({
            ruleCode: result.ruleCode,
            title: result.title,
            message: result.message,
            severity: result.severity,
            passed: result.passed,
            metadata:
              result.metadata === undefined
                ? undefined
                : (result.metadata as Prisma.InputJsonValue),
          })),
        },
      },
      include: {
        results: true,
      },
    });

    await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        status: status === 'APPROVED' ? 'APPROVED' : 'BLOCKED',
      },
    });

    return check;
  }
}