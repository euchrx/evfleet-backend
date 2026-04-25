import { Injectable } from '@nestjs/common';
import { ComplianceContext, ComplianceRule, ComplianceRuleResult } from './compliance-rule.interface';

@Injectable()
export class DriverMoppRule implements ComplianceRule {
  code = 'DRIVER_MOPP_REQUIRED';

  async validate(context: ComplianceContext): Promise<ComplianceRuleResult> {
    if (context.products.length === 0) {
      return {
        ruleCode: this.code,
        title: 'MOPP',
        message: 'A viagem não possui produto perigoso.',
        severity: 'INFO',
        passed: true,
      };
    }

    if (!context.driver) {
      return {
        ruleCode: this.code,
        title: 'MOPP obrigatório',
        message: 'Viagem com produto perigoso exige motorista vinculado.',
        severity: 'BLOCKING',
        passed: false,
      };
    }

    const now = new Date();

    const mopp = context.documents.find(
      (doc) =>
        doc.ownerType === 'DRIVER' &&
        doc.driverId === context.driver?.id &&
        doc.type === 'MOPP' &&
        doc.status === 'VALID' &&
        (!doc.expiryDate || doc.expiryDate >= now),
    );

    return {
      ruleCode: this.code,
      title: 'MOPP do motorista',
      message: mopp
        ? 'Motorista possui MOPP válido.'
        : 'Motorista não possui MOPP válido cadastrado.',
      severity: mopp ? 'INFO' : 'BLOCKING',
      passed: Boolean(mopp),
    };
  }
}