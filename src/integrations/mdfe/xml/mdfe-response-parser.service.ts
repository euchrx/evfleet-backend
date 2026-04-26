import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import type { MdfeIssueResult } from '../mdfe-provider.interface';

@Injectable()
export class MdfeResponseParserService {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
  });

  parseAuthorizationResponse(xml: string): MdfeIssueResult {
    const parsed = this.parser.parse(xml);

    const ret =
      this.findNode(parsed, 'retMDFe') ||
      this.findNode(parsed, 'retEnviMDFe') ||
      this.findNode(parsed, 'retConsReciMDFe');

    const prot = this.findNode(parsed, 'protMDFe');
    const infProt = this.findNode(parsed, 'infProt');

    const cStat = String(infProt?.cStat ?? ret?.cStat ?? '');
    const xMotivo = String(infProt?.xMotivo ?? ret?.xMotivo ?? '');

    const accessKey = infProt?.chMDFe ? String(infProt.chMDFe) : undefined;
    const protocol = infProt?.nProt ? String(infProt.nProt) : undefined;

    if (cStat === '100') {
      return {
        status: 'AUTHORIZED',
        accessKey,
        protocol,
        rawResponse: xml,
      };
    }

    if (['103', '104', '105'].includes(cStat)) {
      return {
        status: 'PROCESSING',
        accessKey,
        protocol,
        rejectionCode: cStat,
        rejectionReason: xMotivo || 'MDF-e em processamento.',
        rawResponse: xml,
      };
    }

    return {
      status: 'REJECTED',
      accessKey,
      protocol,
      rejectionCode: cStat || undefined,
      rejectionReason: xMotivo || 'MDF-e rejeitado pela SEFAZ.',
      rawResponse: xml,
    };
  }

  private findNode(value: unknown, nodeName: string): any {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as Record<string, any>;

    if (record[nodeName]) {
      return record[nodeName];
    }

    for (const key of Object.keys(record)) {
      const found = this.findNode(record[key], nodeName);
      if (found) return found;
    }

    return null;
  }

  parseConsultResponse(xml: string): MdfeIssueResult {
  const parsed = this.parser.parse(xml);

  const ret = this.findNode(parsed, 'retConsSitMDFe');
  const prot = this.findNode(parsed, 'protMDFe');
  const infProt = this.findNode(parsed, 'infProt');

  const cStat = String(infProt?.cStat ?? ret?.cStat ?? '');
  const xMotivo = String(infProt?.xMotivo ?? ret?.xMotivo ?? '');

  const accessKey = infProt?.chMDFe
    ? String(infProt.chMDFe)
    : ret?.chMDFe
      ? String(ret.chMDFe)
      : undefined;

  const protocol = infProt?.nProt ? String(infProt.nProt) : undefined;

  if (cStat === '100') {
    return {
      status: 'AUTHORIZED',
      accessKey,
      protocol,
      rawResponse: xml,
    };
  }

  if (cStat === '101') {
    return {
      status: 'CANCELED',
      accessKey,
      protocol,
      rawResponse: xml,
    };
  }

  if (cStat === '132') {
    return {
      status: 'CLOSED',
      accessKey,
      protocol,
      rawResponse: xml,
    };
  }

  return {
    status: 'REJECTED',
    accessKey,
    protocol,
    rejectionCode: cStat || undefined,
    rejectionReason: xMotivo || 'Consulta MDF-e rejeitada pela SEFAZ.',
    rawResponse: xml,
  };
}
}