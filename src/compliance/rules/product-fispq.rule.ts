import { Injectable } from '@nestjs/common';
import {
  ComplianceContext,
  ComplianceRule,
  ComplianceRuleResult,
} from './compliance-rule.interface';

@Injectable()
export class ProductFispqRule implements ComplianceRule {
  code = 'PRODUCT_FISPQ_REQUIRED';

  async validate(context: ComplianceContext): Promise<ComplianceRuleResult> {
    const products = context.products || [];

    if (products.length === 0) {
      return {
        ruleCode: this.code,
        title: 'FISPQ',
        message: 'Nenhum produto perigoso foi vinculado à viagem.',
        severity: 'BLOCKING',
        passed: false,
      };
    }

    const productsWithoutFispq = products.filter(
      (item) => !String(item.dangerousProduct?.fispqUrl || '').trim(),
    );

    return {
      ruleCode: this.code,
      title: 'FISPQ dos produtos',
      message:
        productsWithoutFispq.length === 0
          ? 'Todos os produtos possuem FISPQ cadastrada.'
          : `Existem produtos perigosos sem FISPQ cadastrada: ${productsWithoutFispq
              .map((item) => item.dangerousProduct?.name || 'Produto não identificado')
              .join(', ')}.`,
      severity: productsWithoutFispq.length === 0 ? 'INFO' : 'BLOCKING',
      passed: productsWithoutFispq.length === 0,
      metadata: {
        productsWithoutFispq: productsWithoutFispq.map((item) => ({
          id: item.dangerousProduct.id,
          name: item.dangerousProduct.name,
          unNumber: item.dangerousProduct.unNumber,
        })),
      },
    };
  }
}