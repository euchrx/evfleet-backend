import { Injectable } from '@nestjs/common';

export type BuildMdfeCloseEventXmlInput = {
  accessKey: string;
  protocol: string;
  environment: 'HOMOLOGATION' | 'PRODUCTION';
  cnpj: string;
  state: string;
  cityIbgeCode: string;
  eventAt: Date;
  closedAt: Date;
  sequence?: number;
};

export type BuildMdfeCancelEventXmlInput = {
  accessKey: string;
  protocol: string;
  environment: 'HOMOLOGATION' | 'PRODUCTION';
  cnpj: string;
  state: string;
  eventAt: Date;
  reason: string;
  sequence?: number;
};

export type BuildMdfeConsultXmlInput = {
  accessKey: string;
  environment: 'HOMOLOGATION' | 'PRODUCTION';
};

@Injectable()
export class MdfeEventXmlBuilder {
  buildCloseEvent(input: BuildMdfeCloseEventXmlInput): string {
    const accessKey = this.onlyDigits(input.accessKey);
    const protocol = this.onlyDigits(input.protocol);
    const cnpj = this.onlyDigits(input.cnpj);
    const sequence = input.sequence ?? 1;
    const sequenceText = String(sequence).padStart(2, '0');
    const tpAmb = input.environment === 'PRODUCTION' ? '1' : '2';
    const tpEvento = '110112';
    const id = `ID${tpEvento}${accessKey}${sequenceText}`;
    const cOrgao = this.ufCode(input.state) || accessKey.slice(0, 2);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<eventoMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00">
  <infEvento Id="${id}">
    <cOrgao>${cOrgao}</cOrgao>
    <tpAmb>${tpAmb}</tpAmb>
    <CNPJ>${cnpj}</CNPJ>
    <chMDFe>${accessKey}</chMDFe>
    <dhEvento>${this.formatSefazDate(input.eventAt)}</dhEvento>
    <tpEvento>${tpEvento}</tpEvento>
    <nSeqEvento>${sequence}</nSeqEvento>
    <detEvento versaoEvento="3.00">
      <descEvento>Encerramento</descEvento>
      <nProt>${protocol}</nProt>
      <dtEnc>${this.formatDate(input.closedAt)}</dtEnc>
      <cUF>${this.ufCode(input.state)}</cUF>
      <cMun>${this.onlyDigits(input.cityIbgeCode)}</cMun>
    </detEvento>
  </infEvento>
</eventoMDFe>`;

    return this.cleanXml(xml);
  }

  buildCancelEvent(input: BuildMdfeCancelEventXmlInput): string {
    const accessKey = this.onlyDigits(input.accessKey);
    const protocol = this.onlyDigits(input.protocol);
    const cnpj = this.onlyDigits(input.cnpj);
    const sequence = input.sequence ?? 1;
    const sequenceText = String(sequence).padStart(2, '0');
    const tpAmb = input.environment === 'PRODUCTION' ? '1' : '2';
    const tpEvento = '110111';
    const id = `ID${tpEvento}${accessKey}${sequenceText}`;
    const cOrgao = this.ufCode(input.state) || accessKey.slice(0, 2);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<eventoMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00">
  <infEvento Id="${id}">
    <cOrgao>${cOrgao}</cOrgao>
    <tpAmb>${tpAmb}</tpAmb>
    <CNPJ>${cnpj}</CNPJ>
    <chMDFe>${accessKey}</chMDFe>
    <dhEvento>${this.formatSefazDate(input.eventAt)}</dhEvento>
    <tpEvento>${tpEvento}</tpEvento>
    <nSeqEvento>${sequence}</nSeqEvento>
    <detEvento versaoEvento="3.00">
      <descEvento>Cancelamento</descEvento>
      <nProt>${protocol}</nProt>
      <xJust>${this.escape(input.reason)}</xJust>
    </detEvento>
  </infEvento>
</eventoMDFe>`;

    return this.cleanXml(xml);
  }

  buildConsultXml(input: BuildMdfeConsultXmlInput): string {
    const accessKey = this.onlyDigits(input.accessKey);
    const tpAmb = input.environment === 'PRODUCTION' ? '1' : '2';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<consSitMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00">
  <tpAmb>${tpAmb}</tpAmb>
  <xServ>CONSULTAR</xServ>
  <chMDFe>${accessKey}</chMDFe>
</consSitMDFe>`;

    return this.cleanXml(xml);
  }

  private formatSefazDate(date: Date): string {
    const d = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}-03:00`;
  }

  private formatDate(date: Date): string {
    const d = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
  }

  private cleanXml(xml: string): string {
    return String(xml || '')
      .replace(/^\uFEFF/, '')
      .replace(/\r/g, '')
      .replace(/\n/g, '')
      .replace(/\t/g, '')
      .replace(/>\s+</g, '><')
      .trim();
  }

  private onlyDigits(value: string | number | null | undefined): string {
    return String(value || '').replace(/\D/g, '');
  }

  private escape(value: string | number | null | undefined): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private ufCode(uf: string): string {
    const map: Record<string, string> = {
      RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
      MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27',
      SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41',
      SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53',
    };

    return map[String(uf || '').trim().toUpperCase().slice(0, 2)] ?? '41';
  }
}
