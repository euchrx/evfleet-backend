import { Injectable } from '@nestjs/common';
import {
  MdfeCancelInput,
  MdfeCloseInput,
  MdfeIssueInput,
  MdfeIssueResult,
  MdfeProvider,
} from './mdfe-provider.interface';

@Injectable()
export class MockMdfeProvider implements MdfeProvider {
  async issue(input: MdfeIssueInput): Promise<MdfeIssueResult> {
    const now = Date.now();
    const issuedAt = new Date().toISOString();
    const accessKey = `MOCK-${input.tripId}-${now}`;
    const protocol = `PROTOCOLO-MOCK-${now}`;

    const requestXml = this.buildXml('MDFeMockEnvio', {
      tripId: input.tripId,
      issuedAt,
    });

    const authorizedXml = this.buildXml('MDFeMockAutorizado', {
      status: 'AUTHORIZED',
      tripId: input.tripId,
      chMDFe: accessKey,
      nProt: protocol,
      issuedAt,
    });

    const responseXml = this.buildXml('RetornoMDFeMock', {
      status: 'AUTHORIZED',
      chMDFe: accessKey,
      nProt: protocol,
      xMotivo: 'Autorizado o uso do MDF-e mock.',
      issuedAt,
    });

    return {
      status: 'AUTHORIZED',
      accessKey,
      protocol,
      requestXml,
      authorizedXml,
      responseXml,
      rawResponse: {
        mock: true,
        tripId: input.tripId,
        issuedAt,
      },
    };
  }

  async cancel(input: MdfeCancelInput): Promise<MdfeIssueResult> {
    const canceledAt = new Date().toISOString();

    const responseXml = this.buildXml('RetornoCancelamentoMDFeMock', {
      status: 'CANCELED',
      chMDFe: input.accessKey,
      xMotivo: input.reason,
      canceledAt,
    });

    return {
      status: 'CANCELED',
      accessKey: input.accessKey,
      responseXml,
      rawResponse: {
        mock: true,
        event: 'CANCEL',
        reason: input.reason,
        canceledAt,
      },
    };
  }

  async close(input: MdfeCloseInput): Promise<MdfeIssueResult> {
    const closedAt = (input.closedAt ?? new Date()).toISOString();

    const responseXml = this.buildXml('RetornoEncerramentoMDFeMock', {
      status: 'CLOSED',
      chMDFe: input.accessKey,
      state: input.state,
      cityIbgeCode: input.cityIbgeCode,
      closedAt,
    });

    return {
      status: 'CLOSED',
      accessKey: input.accessKey,
      responseXml,
      rawResponse: {
        mock: true,
        event: 'CLOSE',
        state: input.state,
        cityIbgeCode: input.cityIbgeCode,
        closedAt,
      },
    };
  }

  async getStatus(accessKey: string): Promise<MdfeIssueResult> {
    const checkedAt = new Date().toISOString();

    const responseXml = this.buildXml('RetornoConsultaMDFeMock', {
      status: 'AUTHORIZED',
      chMDFe: accessKey,
      xMotivo: 'MDF-e mock autorizado.',
      checkedAt,
    });

    return {
      status: 'AUTHORIZED',
      accessKey,
      responseXml,
      rawResponse: {
        mock: true,
        event: 'STATUS',
        checkedAt,
      },
    };
  }

  private buildXml(root: string, values: Record<string, string>) {
    const body = Object.entries(values)
      .map(([key, value]) => `<${key}>${this.escapeXml(value)}</${key}>`)
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?><${root}>${body}</${root}>`;
  }

  private escapeXml(value: string) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}