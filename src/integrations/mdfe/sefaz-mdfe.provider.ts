import { BadRequestException, Injectable } from '@nestjs/common';
import {
  MdfeCancelInput,
  MdfeCloseInput,
  MdfeIssueInput,
  MdfeIssueResult,
  MdfeProvider,
} from './mdfe-provider.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { MdfeXmlBuilder } from './xml/mdfe-xml.builder';
import { MdfeXmlSignerService } from './xml/mdfe-xml-signer.service';
import { MdfeSoapClient } from './soap/mdfe-soap.client';
import { MdfeResponseParserService } from './xml/mdfe-response-parser.service';

@Injectable()
export class SefazMdfeProvider implements MdfeProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xmlBuilder: MdfeXmlBuilder,
    private readonly xmlSigner: MdfeXmlSignerService,
    private readonly soapClient: MdfeSoapClient,
    private readonly responseParser: MdfeResponseParserService,
  ) { }

  async issue(input: MdfeIssueInput): Promise<MdfeIssueResult> {
    const mdfe = await this.prisma.mdfe.findUnique({
      where: { tripId: input.tripId },
      include: {
        company: {
          include: {
            fiscalSettings: true,
          },
        },
        trip: {
          include: {
            vehicle: true,
            driver: true,
          },
        },
      },
    });

    if (!mdfe) {
      throw new BadRequestException('Registro MDF-e não encontrado.');
    }

    const fiscal = mdfe.company.fiscalSettings;

    if (!fiscal) {
      throw new BadRequestException('Configuração fiscal não encontrada.');
    }

    if (!fiscal.certificatePfxUrl || !fiscal.certificatePasswordEncrypted) {
      throw new BadRequestException(
        'Certificado A1 não configurado para a empresa.',
      );
    }

    const authorizationUrl = this.getAuthorizationUrl(fiscal.mdfeEnvironment);

    if (!authorizationUrl) {
      throw new BadRequestException(
        'URL de autorização MDF-e não configurada no .env.',
      );
    }

    const pfxBuffer = await this.loadPfxBuffer(fiscal.certificatePfxUrl);
    const certificatePassword = fiscal.certificatePasswordEncrypted;

    const unsignedXml = this.xmlBuilder.build({
      id: this.buildInfMdfeId({
        state: fiscal.state,
        cnpj: fiscal.cnpj,
        series: mdfe.series,
        number: mdfe.number,
        issuedAt: new Date(),
      }),
      environment: fiscal.mdfeEnvironment,
      series: mdfe.series,
      number: mdfe.number,
      issuedAt: new Date(),
      fiscal: {
        cnpj: fiscal.cnpj,
        corporateName: fiscal.corporateName,
        stateRegistration: fiscal.stateRegistration,
        cityIbgeCode: fiscal.cityIbgeCode,
        cityName: fiscal.cityName,
        state: fiscal.state,
        addressStreet: fiscal.addressStreet,
        addressNumber: fiscal.addressNumber,
        addressDistrict: fiscal.addressDistrict,
        zipCode: fiscal.zipCode,
      },
      vehicle: {
        plate: mdfe.trip.vehicle?.plate ?? '',
        renavam: mdfe.trip.vehicle?.renavam,
      },
      driver: {
        cpf: mdfe.trip.driver?.cpf ?? '',
        name: mdfe.trip.driver?.name ?? '',
      },
      route: {
        originState: fiscal.state,
        destinationState: fiscal.state,
        originCityIbgeCode: fiscal.cityIbgeCode,
        destinationCityIbgeCode: fiscal.cityIbgeCode,
        originCityName: fiscal.cityName,
        destinationCityName: fiscal.cityName,
      },
    });

    const signedXml = this.xmlSigner.sign({
      xml: unsignedXml,
      pfxBuffer,
      password: certificatePassword,
    });

    const soapEnvelope = this.buildAuthorizationSoapEnvelope(
      signedXml,
      fiscal.state,
    );

    const rawResponse = await this.soapClient.post({
      url: authorizationUrl,
      xmlBody: soapEnvelope,
      pfxBuffer,
      password: certificatePassword,
    });

    const parsedResult = this.responseParser.parseAuthorizationResponse(rawResponse);

    return {
      ...parsedResult,
      requestXml: signedXml,
      authorizedXml:
        parsedResult.status === 'AUTHORIZED' ? rawResponse : undefined,
      responseXml: rawResponse,
    };
  }

  async cancel(input: MdfeCancelInput): Promise<MdfeIssueResult> {
    return {
      status: 'CANCELED',
      accessKey: input.accessKey,
      rawResponse: {
        mock: true,
        event: 'CANCEL',
        reason: input.reason,
        canceledAt: new Date().toISOString(),
      },
    };
  }

  async close(input: MdfeCloseInput): Promise<MdfeIssueResult> {
    return {
      status: 'ERROR',
      accessKey: input.accessKey,
      rejectionReason: 'Encerramento SEFAZ ainda não implementado.',
      rawResponse: {
        provider: 'SEFAZ',
        event: 'CLOSE',
        state: input.state,
        cityIbgeCode: input.cityIbgeCode,
      },
    };
  }

  async getStatus(accessKey: string): Promise<MdfeIssueResult> {
    return {
      status: 'ERROR',
      accessKey,
      rejectionReason: 'Consulta SEFAZ ainda não implementada.',
      rawResponse: {
        provider: 'SEFAZ',
        event: 'STATUS',
      },
    };
  }

  private getAuthorizationUrl(environment: 'HOMOLOGATION' | 'PRODUCTION') {
    return environment === 'PRODUCTION'
      ? process.env.MDFE_SEFAZ_AUTHORIZATION_URL_PRODUCTION
      : process.env.MDFE_SEFAZ_AUTHORIZATION_URL_HOMOLOGATION;
  }

  private async loadPfxBuffer(certificatePfxUrl: string): Promise<Buffer> {
    if (certificatePfxUrl.startsWith('base64:')) {
      return Buffer.from(certificatePfxUrl.replace('base64:', ''), 'base64');
    }

    throw new BadRequestException(
      'Por enquanto, certificatePfxUrl precisa estar no formato base64:<conteudo-do-pfx>.',
    );
  }

  private buildAuthorizationSoapEnvelope(signedXml: string, state: string): string {
    const cUF = this.ufCode(state);

    return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    <mdfeCabecMsg xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoSinc">
      <cUF>${cUF}</cUF>
      <versaoDados>3.00</versaoDados>
    </mdfeCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <mdfeDadosMsg xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoSinc">
      ${signedXml}
    </mdfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
  }

  private buildInfMdfeId(input: {
    state: string;
    cnpj: string;
    series: number;
    number: number;
    issuedAt: Date;
  }) {
    const cUF = this.ufCode(input.state);
    const yy = String(input.issuedAt.getFullYear()).slice(-2);
    const mm = String(input.issuedAt.getMonth() + 1).padStart(2, '0');
    const cnpj = this.onlyDigits(input.cnpj).padStart(14, '0');
    const mod = '58';
    const serie = String(input.series).padStart(3, '0');
    const number = String(input.number).padStart(9, '0');
    const tpEmis = '1';
    const cMDF = this.randomCode();

    const partialKey = `${cUF}${yy}${mm}${cnpj}${mod}${serie}${number}${tpEmis}${cMDF}`;
    const dv = this.mod11(partialKey);

    return `MDFe${partialKey}${dv}`;
  }

  private mod11(value: string): string {
    let weight = 2;
    let sum = 0;

    for (let i = value.length - 1; i >= 0; i -= 1) {
      sum += Number(value[i]) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }

    const rest = sum % 11;
    const digit = rest === 0 || rest === 1 ? 0 : 11 - rest;

    return String(digit);
  }

  private randomCode(): string {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }

  private onlyDigits(value: string): string {
    return String(value || '').replace(/\D/g, '');
  }

  private ufCode(uf: string): string {
    const map: Record<string, string> = {
      RO: '11',
      AC: '12',
      AM: '13',
      RR: '14',
      PA: '15',
      AP: '16',
      TO: '17',
      MA: '21',
      PI: '22',
      CE: '23',
      RN: '24',
      PB: '25',
      PE: '26',
      AL: '27',
      SE: '28',
      BA: '29',
      MG: '31',
      ES: '32',
      RJ: '33',
      SP: '35',
      PR: '41',
      SC: '42',
      RS: '43',
      MS: '50',
      MT: '51',
      GO: '52',
      DF: '53',
    };

    return map[inputSafeUpper(uf)] ?? '41';
  }
}

function inputSafeUpper(value: string) {
  return String(value || '').toUpperCase();
}