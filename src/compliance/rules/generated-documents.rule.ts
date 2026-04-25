import { Injectable } from '@nestjs/common';
import {
  ComplianceContext,
  ComplianceRule,
  ComplianceRuleResult,
} from './compliance-rule.interface';

@Injectable()
export class GeneratedDocumentsRule implements ComplianceRule {
  code = 'GENERATED_DOCUMENTS_REQUIRED';

  async validate(context: ComplianceContext): Promise<ComplianceRuleResult> {
    if (context.products.length === 0) {
      return {
        ruleCode: this.code,
        title: 'Documentos da viagem',
        message: 'A viagem não possui produto perigoso.',
        severity: 'INFO',
        passed: true,
      };
    }

    const hasEmergencySheet = context.generatedDocuments.some(
      (doc) =>
        doc.type === 'EMERGENCY_SHEET' &&
        ['DRAFT', 'GENERATED', 'SENT'].includes(doc.status),
    );

    const hasMdfe = context.generatedDocuments.some(
      (doc) =>
        doc.type === 'MDFE_MOCK' &&
        ['DRAFT', 'GENERATED', 'SENT'].includes(doc.status),
    );

    const missing: string[] = [];

    if (!hasEmergencySheet) missing.push('Ficha de emergência');
    if (!hasMdfe) missing.push('MDF-e');

    return {
      ruleCode: this.code,
      title: 'Documentos obrigatórios',
      message:
        missing.length === 0
          ? 'Ficha de emergência e MDF-e estão gerados.'
          : `Documentos pendentes: ${missing.join(', ')}.`,
      severity: missing.length === 0 ? 'INFO' : 'BLOCKING',
      passed: missing.length === 0,
      metadata: {
        missing,
      },
    };
  }
}