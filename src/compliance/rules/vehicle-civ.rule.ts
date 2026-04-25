import { Injectable } from '@nestjs/common';
import { ComplianceContext, ComplianceRule, ComplianceRuleResult } from './compliance-rule.interface';

@Injectable()
export class VehicleCivRule implements ComplianceRule {
  code = 'VEHICLE_CIV_REQUIRED';

  async validate(context: ComplianceContext): Promise<ComplianceRuleResult> {
    if (context.products.length === 0) {
      return {
        ruleCode: this.code,
        title: 'CIV',
        message: 'A viagem não possui produto perigoso.',
        severity: 'INFO',
        passed: true,
      };
    }

    const now = new Date();

    const civ = context.documents.find(
      (doc) =>
        doc.ownerType === 'VEHICLE' &&
        doc.vehicleId === context.vehicle.id &&
        doc.type === 'CIV' &&
        doc.status === 'VALID' &&
        (!doc.expiryDate || doc.expiryDate >= now),
    );

    return {
      ruleCode: this.code,
      title: 'CIV do veículo',
      message: civ
        ? 'Veículo possui CIV válido.'
        : 'Veículo não possui CIV válido.',
      severity: civ ? 'INFO' : 'BLOCKING',
      passed: Boolean(civ),
    };
  }
}