import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import type { MdfeIssueResult } from '../mdfe-provider.interface';

type ExpectedEvent = 'CLOSE' | 'CANCEL';

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

    const infProt = this.findNode(parsed, 'infProt');
    const protMdfeXml = this.extractTagXml(xml, 'protMDFe');

    const cStat = String(infProt?.cStat ?? ret?.cStat ?? '');
    const xMotivo = String(infProt?.xMotivo ?? ret?.xMotivo ?? '');
    const accessKey = infProt?.chMDFe ? String(infProt.chMDFe) : undefined;
    const protocol = infProt?.nProt ? String(infProt.nProt) : undefined;
    const authorizedAt = infProt?.dhRecbto
      ? new Date(String(infProt.dhRecbto))
      : undefined;

    if (cStat === '100') {
      return {
        status: 'AUTHORIZED',
        accessKey,
        protocol,
        authorizedAt,
        protMdfeXml,
        rawResponse: xml,
      };
    }

    if (['103', '104', '105'].includes(cStat)) {
      return {
        status: 'PROCESSING',
        accessKey,
        protocol,
        authorizedAt,
        protMdfeXml,
        rejectionCode: cStat,
        rejectionReason: xMotivo || 'MDF-e em processamento.',
        rawResponse: xml,
      };
    }

    return {
      status: 'REJECTED',
      accessKey,
      protocol,
      authorizedAt,
      protMdfeXml,
      rejectionCode: cStat || undefined,
      rejectionReason: xMotivo || 'MDF-e rejeitado pela SEFAZ.',
      rawResponse: xml,
    };
  }

  parseConsultResponse(xml: string): MdfeIssueResult {
    const parsed = this.parser.parse(xml);

    const ret = this.findNode(parsed, 'retConsSitMDFe');
    const infProt = this.findNode(parsed, 'infProt');
    const infEvento = this.findNode(parsed, 'infEvento');
    const protMdfeXml = this.extractTagXml(xml, 'protMDFe');

    const cStat = String(infProt?.cStat ?? ret?.cStat ?? '');
    const xMotivo = String(infProt?.xMotivo ?? ret?.xMotivo ?? '');
    const accessKey = infProt?.chMDFe
      ? String(infProt.chMDFe)
      : ret?.chMDFe
        ? String(ret.chMDFe)
        : undefined;
    const protocol = infProt?.nProt ? String(infProt.nProt) : undefined;
    const authorizedAt = infProt?.dhRecbto
      ? new Date(String(infProt.dhRecbto))
      : undefined;

    const eventType = infEvento?.tpEvento ? String(infEvento.tpEvento) : '';

    if (eventType === '110112') {
      return {
        status: 'CLOSED',
        accessKey,
        protocol,
        authorizedAt,
        protMdfeXml,
        rejectionCode: cStat || undefined,
        rejectionReason: xMotivo || undefined,
        rawResponse: xml,
      };
    }

    if (eventType === '110111') {
      return {
        status: 'CANCELED',
        accessKey,
        protocol,
        authorizedAt,
        protMdfeXml,
        rejectionCode: cStat || undefined,
        rejectionReason: xMotivo || undefined,
        rawResponse: xml,
      };
    }

    if (cStat === '100') {
      return {
        status: 'AUTHORIZED',
        accessKey,
        protocol,
        authorizedAt,
        protMdfeXml,
        rawResponse: xml,
      };
    }

    if (cStat === '101') {
      return {
        status: 'CANCELED',
        accessKey,
        protocol,
        authorizedAt,
        protMdfeXml,
        rawResponse: xml,
      };
    }

    if (cStat === '132') {
      return {
        status: 'CLOSED',
        accessKey,
        protocol,
        authorizedAt,
        protMdfeXml,
        rawResponse: xml,
      };
    }

    return {
      status: 'REJECTED',
      accessKey,
      protocol,
      authorizedAt,
      protMdfeXml,
      rejectionCode: cStat || undefined,
      rejectionReason: xMotivo || 'Consulta MDF-e rejeitada pela SEFAZ.',
      rawResponse: xml,
    };
  }

  parseEventResponse(xml: string, expectedEvent: ExpectedEvent): MdfeIssueResult {
    const parsed = this.parser.parse(xml);

    const ret =
      this.findNode(parsed, 'retEventoMDFe') ||
      this.findNode(parsed, 'retEnvEvento') ||
      this.findNode(parsed, 'retEnvEventoMDFe');

    const infEvento = this.findNode(parsed, 'infEvento');
    const cStat = String(infEvento?.cStat ?? ret?.cStat ?? '');
    const xMotivo = String(infEvento?.xMotivo ?? ret?.xMotivo ?? '');
    const accessKey = infEvento?.chMDFe ? String(infEvento.chMDFe) : undefined;
    const protocol = infEvento?.nProt ? String(infEvento.nProt) : undefined;
    const authorizedAt = infEvento?.dhRegEvento
      ? new Date(String(infEvento.dhRegEvento))
      : undefined;

    const successCodes = ['135', '136', '155'];
    const duplicatedCodes = ['573'];

    if (successCodes.includes(cStat) || duplicatedCodes.includes(cStat)) {
      return {
        status: expectedEvent === 'CANCEL' ? 'CANCELED' : 'CLOSED',
        accessKey,
        protocol,
        authorizedAt,
        rejectionCode: cStat,
        rejectionReason:
          xMotivo ||
          (expectedEvent === 'CANCEL'
            ? 'Evento de cancelamento registrado.'
            : 'Evento de encerramento registrado.'),
        rawResponse: xml,
      };
    }

    return {
      status: 'REJECTED',
      accessKey,
      protocol,
      authorizedAt,
      rejectionCode: cStat || undefined,
      rejectionReason: xMotivo || 'Evento MDF-e rejeitado pela SEFAZ.',
      rawResponse: xml,
    };
  }

  buildMdfeProcXml(input: {
    signedXml: string;
    protMdfeXml?: string;
  }): string | undefined {
    if (!input.protMdfeXml) {
      return undefined;
    }

    const mdfeXml = this.extractTagXml(input.signedXml, 'MDFe');

    if (!mdfeXml) {
      return undefined;
    }

    return `<?xml version="1.0" encoding="UTF-8"?><mdfeProc xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00">${mdfeXml}${input.protMdfeXml}</mdfeProc>`;
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

  private extractTagXml(xml: string, tagName: string): string | undefined {
    const source = String(xml || '').replace(/^\uFEFF/, '');
    const regex = new RegExp(
      `<(?:[A-Za-z0-9_]+:)?${tagName}\\b[^>]*>[\\s\\S]*?</(?:[A-Za-z0-9_]+:)?${tagName}>`,
      'i',
    );
    const match = source.match(regex);

    if (!match?.[0]) {
      return undefined;
    }

    return match[0]
      .replace(/(<\/?)([A-Za-z0-9_]+:)/g, '$1')
      .replace(/\s+xmlns(?::[A-Za-z0-9_]+)?="[^"]*"/g, '')
      .trim();
  }
}
