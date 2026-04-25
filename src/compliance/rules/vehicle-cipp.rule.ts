import { Injectable } from '@nestjs/common';
import { ComplianceContext, ComplianceRule, ComplianceRuleResult } from './compliance-rule.interface';

@Injectable()
export class VehicleCippRule implements ComplianceRule {
  code = 'VEHICLE_CIPP_REQUIRED';

  async validate(context: ComplianceContext): Promise<ComplianceRuleResult> {
    if (context.products.length === 0) {
      return {
        ruleCode: this.code,
        title: 'CIPP',
        message: 'A viagem não possui produto perigoso.',
        severity: 'INFO',
        passed: true,
      };
    }

    const now = new Date();

    const cipp = context.documents.find(
      (doc) =>
        doc.ownerType === 'VEHICLE' &&
        doc.vehicleId === context.vehicle.id &&
        doc.type === 'CIPP' &&
        doc.status === 'VALID' &&
        (!doc.expiryDate || doc.expiryDate >= now),
    );

    return {
      ruleCode: this.code,
      title: 'CIPP do equipamento',
      message: cipp
        ? 'Veículo/equipamento possui CIPP válido.'
        : 'Veículo/equipamento não possui CIPP válido.',
      severity: cipp ? 'INFO' : 'BLOCKING',
      passed: Boolean(cipp),
    };
  }
}