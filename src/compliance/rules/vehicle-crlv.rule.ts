import { Injectable } from '@nestjs/common';
import { ComplianceContext, ComplianceRule, ComplianceRuleResult } from './compliance-rule.interface';

@Injectable()
export class VehicleCrlvRule implements ComplianceRule {
  code = 'VEHICLE_CRLV_REQUIRED';

  async validate(context: ComplianceContext): Promise<ComplianceRuleResult> {
    const now = new Date();

    const crlv = context.documents.find(
      (doc) =>
        doc.ownerType === 'VEHICLE' &&
        doc.vehicleId === context.vehicle.id &&
        doc.type === 'CRLV' &&
        doc.status === 'VALID' &&
        (!doc.expiryDate || doc.expiryDate >= now),
    );

    return {
      ruleCode: this.code,
      title: 'CRLV do veículo',
      message: crlv
        ? 'Veículo possui CRLV válido.'
        : 'Veículo não possui CRLV válido.',
      severity: crlv ? 'INFO' : 'BLOCKING',
      passed: Boolean(crlv),
    };
  }
}