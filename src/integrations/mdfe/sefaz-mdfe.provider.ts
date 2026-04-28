import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  MdfeCancelInput,
  MdfeCloseInput,
  MdfeIssueInput,
  MdfeIssueResult,
  MdfeProvider,
} from './mdfe-provider.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { MdfeXmlBuilder } from './xml/mdfe-xml.builder';
import { MdfeEventXmlBuilder } from './xml/mdfe-event-xml.builder';
import { MdfeXmlSignerService } from './xml/mdfe-xml-signer.service';
import { MdfeSoapClient } from './soap/mdfe-soap.client';
import { MdfeResponseParserService } from './xml/mdfe-response-parser.service';
import * as zlib from 'zlib';
type FiscalDocumentType = 'CTE' | 'NFE';

type FiscalDocumentSource = {
  type: FiscalDocumentType;
  accessKey: string;
};

type TripProductSource = {
  quantity: unknown;
  invoiceKey: string | null;
  dangerousProduct: {
    name: string;
    commercialName: string | null;
  };
};

@Injectable()
export class SefazMdfeProvider implements MdfeProvider {
  private readonly logger = new Logger(SefazMdfeProvider.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly xmlBuilder: MdfeXmlBuilder,
    private readonly eventXmlBuilder: MdfeEventXmlBuilder,
    private readonly xmlSigner: MdfeXmlSignerService,
    private readonly soapClient: MdfeSoapClient,
    private readonly responseParser: MdfeResponseParserService,
  ) {}

  async issue(input: MdfeIssueInput): Promise<MdfeIssueResult> {
    const mdfe = await this.prisma.mdfe.findFirst({
      where: { tripId: input.tripId },
      orderBy: { createdAt: 'desc' },
      include: {
        company: {
          include: {
            fiscalSettings: true,
            vehicleDocuments: {
              where: {
                type: { in: ['RNTRC', 'INSURANCE'] },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        trip: {
          include: {
            fiscalDocuments: {
              orderBy: { createdAt: 'asc' },
            },
            vehicle: {
              include: {
                documents: {
                  where: {
                    type: { in: ['RNTRC', 'INSURANCE'] },
                  },
                  orderBy: { createdAt: 'desc' },
                },
                implementLinks: {
                  orderBy: { position: 'asc' },
                  include: {
                    implement: true,
                  },
                },
              },
            },
            driver: true,
            products: {
              include: {
                dangerousProduct: true,
              },
            },
          },
        },
      },
    });

    if (!mdfe) {
      throw new BadRequestException('Registro MDF-e não encontrado.');
    }

    if (mdfe.status === 'AUTHORIZED') {
      throw new BadRequestException(
        'MDF-e já autorizado. Não é permitido emitir novamente.',
      );
    }

    if (mdfe.status === 'CLOSED' || mdfe.status === 'CANCELED') {
      throw new BadRequestException(
        'MDF-e encerrado ou cancelado não pode ser emitido novamente.',
      );
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
    const issuedAt = new Date();

    const infMdfeId = this.buildInfMdfeId({
      state: fiscal.state,
      cnpj: fiscal.cnpj,
      series: mdfe.series,
      number: mdfe.number,
      issuedAt,
    });

    const documents = this.resolveFiscalDocuments({
      fiscalDocuments: mdfe.trip.fiscalDocuments,
      products: mdfe.trip.products,
    });

    const rntrc = this.resolveRntrc({
      fiscalRntrc: fiscal.rntrc,
      companyDocuments: mdfe.company.vehicleDocuments,
      vehicleDocuments: mdfe.trip.vehicle?.documents ?? [],
    });

    const cargo = this.resolveCargo({
      trip: mdfe.trip,
      products: mdfe.trip.products,
    });

    const insurance = this.resolveInsurance({
      trip: mdfe.trip,
      fiscal,
      companyDocuments: mdfe.company.vehicleDocuments,
      vehicleDocuments: mdfe.trip.vehicle?.documents ?? [],
      responsibleDocument: fiscal.cnpj,
      responsibleName: fiscal.corporateName,
    });

    const payment = this.resolvePayment({
      trip: mdfe.trip,
      fiscalCnpj: fiscal.cnpj,
      fiscalName: fiscal.corporateName,
      fallbackValue: cargo.totalValue,
      defaultPixKey: fiscal.mdfePaymentPixKey,
    });

    const route = this.resolveRoute({
      trip: mdfe.trip,
      fiscal,
    });

    this.validateIssuePayload({
      vehiclePlate: mdfe.trip.vehicle?.plate,
      driverCpf: mdfe.trip.driver?.cpf,
      driverName: mdfe.trip.driver?.name,
      rntrc,
      route,
      documents,
      cargoTotalValue: cargo.totalValue,
      cargoQuantity: cargo.quantity,
    });

    const unsignedXmlPretty = this.xmlBuilder.build({
      id: infMdfeId,
      environment: fiscal.mdfeEnvironment,
      series: mdfe.series,
      number: mdfe.number,
      issuedAt,
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
        uf: route.originState || fiscal.state,
        tara: this.resolveVehicleTara(),
        reboques:
          mdfe.trip.vehicle?.implementLinks.map((link) => ({
            plate: link.implement.plate,
            renavam: link.implement.renavam,
            uf: route.originState || fiscal.state,
            tara: this.resolveImplementTara(),
            capKG: null,
            capM3: null,
          })) ?? [],
      },
      driver: {
        cpf: mdfe.trip.driver?.cpf ?? '',
        name: mdfe.trip.driver?.name ?? '',
      },
      route,
      antt: {
        rntrc,
      },
      documents,
      insurance,
      payment,
      cargo,
      additionalInfo: mdfe.trip.notes,
    });

    const unsignedXml = this.cleanXmlBeforeSign(unsignedXmlPretty);

    const signedXml = this.xmlSigner.sign({
      xml: unsignedXml,
      pfxBuffer,
      password: certificatePassword,
    });

    const xmlToSend = signedXml.replace(/^\uFEFF/, '');

    const compressedBase64 = zlib
      .gzipSync(Buffer.from(xmlToSend, 'utf-8'))
      .toString('base64');

    const soapEnvelope = this.buildAuthorizationSoapEnvelope(compressedBase64);

    this.logger.log(
      `Enviando MDF-e para SEFAZ. tripId=${mdfe.tripId} companyId=${mdfe.companyId} serie=${mdfe.series} numero=${mdfe.number}`,
    );

    const rawResponse = await this.soapClient.post({
      url: authorizationUrl,
      soapAction:
        'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoSinc/mdfeRecepcao',
      xmlBody: soapEnvelope,
      pfxBuffer,
      password: certificatePassword,
      operation: 'AUTORIZACAO_MDFE',
    });

    const parsedResult =
      this.responseParser.parseAuthorizationResponse(rawResponse);

    const authorizedXml =
      parsedResult.status === 'AUTHORIZED'
        ? this.responseParser.buildMdfeProcXml({
            signedXml,
            protMdfeXml: parsedResult.protMdfeXml,
          })
        : undefined;

    return {
      ...parsedResult,
      requestXml: signedXml,
      authorizedXml,
      responseXml: rawResponse,
    };
  }

  async cancel(input: MdfeCancelInput): Promise<MdfeIssueResult> {
    const accessKey = this.onlyDigits(input.accessKey);

    if (accessKey.length !== 44) {
      throw new BadRequestException('Chave de acesso do MDF-e inválida para cancelamento.');
    }

    const reason = String(input.reason || '').trim();

    if (reason.length < 15 || reason.length > 255) {
      throw new BadRequestException(
        'O motivo do cancelamento deve ter entre 15 e 255 caracteres.',
      );
    }

    const mdfe = await this.prisma.mdfe.findFirst({
      where: { accessKey },
      include: {
        company: {
          include: {
            fiscalSettings: true,
          },
        },
      },
    });

    if (!mdfe) {
      throw new BadRequestException('MDF-e não encontrado no banco para cancelamento.');
    }

    const fiscal = mdfe.company.fiscalSettings;

    if (!fiscal) {
      throw new BadRequestException('Configuração fiscal não encontrada para cancelamento.');
    }

    if (!fiscal.certificatePfxUrl || !fiscal.certificatePasswordEncrypted) {
      throw new BadRequestException(
        'Certificado A1 não configurado para a empresa.',
      );
    }

    const protocol = this.onlyDigits(input.protocol || mdfe.protocol || '');

    if (!protocol) {
      throw new BadRequestException('Protocolo de autorização obrigatório para cancelamento.');
    }

    const eventUrl = this.getEventUrl(fiscal.mdfeEnvironment);

    if (!eventUrl) {
      throw new BadRequestException(
        'URL de evento MDF-e não configurada no .env.',
      );
    }

    const pfxBuffer = await this.loadPfxBuffer(fiscal.certificatePfxUrl);
    const certificatePassword = fiscal.certificatePasswordEncrypted;

    const eventXml = this.eventXmlBuilder.buildCancelEvent({
      accessKey,
      protocol,
      environment: fiscal.mdfeEnvironment,
      cnpj: fiscal.cnpj,
      state: fiscal.state,
      eventAt: new Date(),
      reason,
      sequence: 1,
    });

    const signedEventXml = this.xmlSigner.signEvent({
      xml: eventXml,
      pfxBuffer,
      password: certificatePassword,
    });

    const soapEnvelope = this.buildEventSoapEnvelope(signedEventXml);

    this.logger.log(
      `Enviando evento de cancelamento MDF-e para SEFAZ. chMDFe=${accessKey} companyId=${mdfe.companyId}`,
    );

    const rawResponse = await this.soapClient.post({
      url: eventUrl,
      soapAction:
        process.env.MDFE_SEFAZ_EVENT_SOAP_ACTION ||
        'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoEvento/mdfeRecepcaoEvento',
      xmlBody: soapEnvelope,
      pfxBuffer,
      password: certificatePassword,
      operation: 'CANCELAMENTO_MDFE',
    });

    const parsedResult = this.responseParser.parseEventResponse(rawResponse, 'CANCEL');

    return {
      ...parsedResult,
      accessKey: parsedResult.accessKey ?? accessKey,
      protocol: parsedResult.protocol ?? protocol,
      requestXml: signedEventXml,
      responseXml: rawResponse,
    };
  }

  async close(input: MdfeCloseInput): Promise<MdfeIssueResult> {
    const accessKey = this.onlyDigits(input.accessKey);

    if (accessKey.length !== 44) {
      throw new BadRequestException('Chave de acesso do MDF-e inválida para encerramento.');
    }

    const mdfe = await this.prisma.mdfe.findFirst({
      where: { accessKey },
      include: {
        company: {
          include: {
            fiscalSettings: true,
          },
        },
      },
    });

    if (!mdfe) {
      throw new BadRequestException('MDF-e não encontrado no banco para encerramento.');
    }

    const fiscal = mdfe.company.fiscalSettings;

    if (!fiscal) {
      throw new BadRequestException('Configuração fiscal não encontrada para encerramento.');
    }

    if (!fiscal.certificatePfxUrl || !fiscal.certificatePasswordEncrypted) {
      throw new BadRequestException(
        'Certificado A1 não configurado para a empresa.',
      );
    }

    const protocol = this.onlyDigits(input.protocol || mdfe.protocol || '');

    if (!protocol) {
      throw new BadRequestException('Protocolo de autorização obrigatório para encerramento.');
    }

    const eventUrl = this.getEventUrl(fiscal.mdfeEnvironment);

    if (!eventUrl) {
      throw new BadRequestException(
        'URL de evento MDF-e não configurada no .env.',
      );
    }

    const pfxBuffer = await this.loadPfxBuffer(fiscal.certificatePfxUrl);
    const certificatePassword = fiscal.certificatePasswordEncrypted;
    const closedAt = input.closedAt ?? new Date();

    const eventXml = this.eventXmlBuilder.buildCloseEvent({
      accessKey,
      protocol,
      environment: fiscal.mdfeEnvironment,
      cnpj: fiscal.cnpj,
      state: input.state || fiscal.state,
      cityIbgeCode: input.cityIbgeCode || fiscal.cityIbgeCode,
      eventAt: new Date(),
      closedAt,
      sequence: 1,
    });

    const signedEventXml = this.xmlSigner.signEvent({
      xml: eventXml,
      pfxBuffer,
      password: certificatePassword,
    });

    const soapEnvelope = this.buildEventSoapEnvelope(signedEventXml);

    this.logger.log(
      `Enviando evento de encerramento MDF-e para SEFAZ. chMDFe=${accessKey} companyId=${mdfe.companyId}`,
    );

    const rawResponse = await this.soapClient.post({
      url: eventUrl,
      soapAction:
        process.env.MDFE_SEFAZ_EVENT_SOAP_ACTION ||
        'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoEvento/mdfeRecepcaoEvento',
      xmlBody: soapEnvelope,
      pfxBuffer,
      password: certificatePassword,
      operation: 'ENCERRAMENTO_MDFE',
    });

    const parsedResult = this.responseParser.parseEventResponse(rawResponse, 'CLOSE');

    return {
      ...parsedResult,
      accessKey: parsedResult.accessKey ?? accessKey,
      protocol: parsedResult.protocol ?? protocol,
      requestXml: signedEventXml,
      responseXml: rawResponse,
    };
  }

  async getStatus(accessKey: string): Promise<MdfeIssueResult> {
    const normalizedAccessKey = this.onlyDigits(accessKey);

    if (normalizedAccessKey.length !== 44) {
      throw new BadRequestException('Chave de acesso do MDF-e inválida para consulta.');
    }

    const mdfe = await this.prisma.mdfe.findFirst({
      where: { accessKey: normalizedAccessKey },
      include: {
        company: {
          include: {
            fiscalSettings: true,
          },
        },
      },
    });

    if (!mdfe) {
      throw new BadRequestException('MDF-e não encontrado no banco para consulta.');
    }

    const fiscal = mdfe.company.fiscalSettings;

    if (!fiscal) {
      throw new BadRequestException('Configuração fiscal não encontrada para consulta.');
    }

    if (!fiscal.certificatePfxUrl || !fiscal.certificatePasswordEncrypted) {
      throw new BadRequestException(
        'Certificado A1 não configurado para a empresa.',
      );
    }

    const consultUrl = this.getConsultUrl(fiscal.mdfeEnvironment);

    if (!consultUrl) {
      throw new BadRequestException(
        'URL de consulta MDF-e não configurada no .env.',
      );
    }

    const pfxBuffer = await this.loadPfxBuffer(fiscal.certificatePfxUrl);
    const certificatePassword = fiscal.certificatePasswordEncrypted;

    const consultXml = this.eventXmlBuilder.buildConsultXml({
      accessKey: normalizedAccessKey,
      environment: fiscal.mdfeEnvironment,
    });

    const soapEnvelope = this.buildConsultSoapEnvelope(consultXml);

    this.logger.log(
      `Consultando MDF-e na SEFAZ. chMDFe=${normalizedAccessKey} companyId=${mdfe.companyId}`,
    );

    const rawResponse = await this.soapClient.post({
      url: consultUrl,
      soapAction:
        process.env.MDFE_SEFAZ_CONSULT_SOAP_ACTION ||
        'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeConsulta/mdfeConsultaMDF',
      xmlBody: soapEnvelope,
      pfxBuffer,
      password: certificatePassword,
      operation: 'CONSULTA_MDFE',
    });

    const parsedResult = this.responseParser.parseConsultResponse(rawResponse);

    return {
      ...parsedResult,
      accessKey: parsedResult.accessKey ?? normalizedAccessKey,
      protocol: parsedResult.protocol ?? mdfe.protocol ?? undefined,
      requestXml: consultXml,
      responseXml: rawResponse,
    };
  }

  private resolveFiscalDocuments(input: {
    fiscalDocuments: Array<{ type: string; accessKey: string }>;
    products: Array<{ invoiceKey: string | null }>;
  }): FiscalDocumentSource[] {
    const fromFiscalDocuments = input.fiscalDocuments
      .map((document) => ({
        type: String(document.type) === 'CTE' ? 'CTE' : 'NFE',
        accessKey: this.onlyDigits(document.accessKey),
      }))
      .filter((document) => document.accessKey.length === 44) as FiscalDocumentSource[];

    const fromProducts = input.products
      .map((product) => this.onlyDigits(product.invoiceKey || ''))
      .filter((key) => key.length === 44)
      .map((accessKey) => ({
        type: this.detectFiscalDocumentType(accessKey),
        accessKey,
      }));

    const all = [...fromFiscalDocuments, ...fromProducts];
    const uniqueByKey = new Map<string, FiscalDocumentSource>();

    for (const document of all) {
      uniqueByKey.set(document.accessKey, document);
    }

    return Array.from(uniqueByKey.values());
  }

  private detectFiscalDocumentType(accessKey: string): FiscalDocumentType {
    const model = accessKey.slice(20, 22);
    return model === '57' ? 'CTE' : 'NFE';
  }

  private resolveRntrc(input: {
    fiscalRntrc?: string | null;
    companyDocuments: Array<{ type: string; number: string | null }>;
    vehicleDocuments: Array<{ type: string; number: string | null }>;
  }): string {
    const fiscalRntrc = this.onlyDigits(input.fiscalRntrc || '');

    if (fiscalRntrc) {
      return fiscalRntrc;
    }

    const vehicleRntrc = input.vehicleDocuments.find(
      (document) => document.type === 'RNTRC' && document.number,
    )?.number;

    const companyRntrc = input.companyDocuments.find(
      (document) => document.type === 'RNTRC' && document.number,
    )?.number;

    return this.onlyDigits(vehicleRntrc || companyRntrc || '');
  }

  private resolveInsurance(input: {
    trip: {
      insuranceCompanyName?: string | null;
      insuranceCompanyDocument?: string | null;
      insurancePolicyNumber?: string | null;
      insuranceEndorsement?: string | null;
    };
    fiscal: {
      cnpj: string;
      corporateName: string;
      mdfeDefaultInsurerName?: string | null;
      mdfeDefaultInsurerDocument?: string | null;
      mdfeDefaultPolicyNumber?: string | null;
    };
    companyDocuments: Array<{
      type: string;
      number: string | null;
      issuer: string | null;
    }>;
    vehicleDocuments: Array<{
      type: string;
      number: string | null;
      issuer: string | null;
    }>;
    responsibleDocument: string;
    responsibleName: string;
  }) {
    if (
      input.trip.insuranceCompanyName &&
      input.trip.insuranceCompanyDocument &&
      input.trip.insurancePolicyNumber
    ) {
      return {
        responsibleDocument: input.responsibleDocument,
        responsibleName: input.responsibleName,
        insurerName: input.trip.insuranceCompanyName,
        insurerDocument: input.trip.insuranceCompanyDocument,
        policyNumber: input.trip.insurancePolicyNumber,
        endorsementNumber: input.trip.insuranceEndorsement ?? null,
      };
    }

    if (
      input.fiscal.mdfeDefaultInsurerName &&
      input.fiscal.mdfeDefaultInsurerDocument &&
      input.fiscal.mdfeDefaultPolicyNumber
    ) {
      return {
        responsibleDocument: input.responsibleDocument,
        responsibleName: input.responsibleName,
        insurerName: input.fiscal.mdfeDefaultInsurerName,
        insurerDocument: input.fiscal.mdfeDefaultInsurerDocument,
        policyNumber: input.fiscal.mdfeDefaultPolicyNumber,
        endorsementNumber: null,
      };
    }

    const vehicleInsurance = input.vehicleDocuments.find(
      (document) => document.type === 'INSURANCE' && document.number,
    );

    const companyInsurance = input.companyDocuments.find(
      (document) => document.type === 'INSURANCE' && document.number,
    );

    const insurance = vehicleInsurance || companyInsurance;

    if (!insurance?.number || !insurance.issuer) {
      return null;
    }

    return {
      responsibleDocument: input.responsibleDocument,
      responsibleName: input.responsibleName,
      insurerName: insurance.issuer,
      insurerDocument:
        process.env.MDFE_DEFAULT_INSURANCE_CNPJ || input.responsibleDocument,
      policyNumber: insurance.number,
      endorsementNumber: null,
    };
  }

  private resolvePayment(input: {
    trip: {
      contractorName?: string | null;
      contractorDocument?: string | null;
      paymentIndicator?: string | null;
      paymentValue?: unknown;
      paymentPixKey?: string | null;
    };
    fiscalCnpj: string;
    fiscalName: string;
    fallbackValue: number;
    defaultPixKey?: string | null;
  }) {
    const contractorName = input.trip.contractorName || input.fiscalName;
    const contractorDocument = input.trip.contractorDocument || input.fiscalCnpj;
    const contractValue = Number(input.trip.paymentValue || input.fallbackValue || 0);
    const paymentIndicator =
      input.trip.paymentIndicator === 'PAID' ? '1' : '0';

    return {
      contractorName,
      contractorDocument,
      componentType: '99',
      componentDescription: 'Frete',
      componentValue: contractValue,
      contractValue,
      paymentIndicator: paymentIndicator as '0' | '1',
      pixKey: input.trip.paymentPixKey || input.defaultPixKey || null,
    };
  }

  private resolveCargo(input: {
    trip: {
      cargoDescription?: string | null;
      cargoNcm?: string | null;
      cargoValue?: unknown;
      cargoQuantity?: unknown;
      cargoUnit?: string | null;
    };
    products: TripProductSource[];
  }) {
    const firstProduct = input.products[0];
    const productsQuantity = input.products.reduce(
      (sum, product) => sum + Number(product.quantity || 0),
      0,
    );

    const description =
      input.trip.cargoDescription ||
      firstProduct?.dangerousProduct.commercialName ||
      firstProduct?.dangerousProduct.name ||
      'Carga transportada';

    const totalValue = Number(input.trip.cargoValue || 0);
    const quantity = Number(input.trip.cargoQuantity || productsQuantity || 0);

    return {
      productDescription: description,
      cargoType: '08',
      ncm: input.trip.cargoNcm || null,
      totalValue: totalValue > 0 ? totalValue : Math.max(1, quantity || 1),
      unitCode: input.trip.cargoUnit === 'TON' ? '02' : '01',
      quantity: quantity > 0 ? quantity : 1,
    };
  }

  private resolveRoute(input: {
    trip: {
      origin: string;
      destination: string;
      originState?: string | null;
      originCityName?: string | null;
      originCityIbgeCode?: string | null;
      originZipCode?: string | null;
      destinationState?: string | null;
      destinationCityName?: string | null;
      destinationCityIbgeCode?: string | null;
      destinationZipCode?: string | null;
    };
    fiscal: {
      state: string;
      cityName: string;
      cityIbgeCode: string;
      zipCode: string;
    };
  }) {
    return {
      originState: input.trip.originState || input.fiscal.state,
      destinationState: input.trip.destinationState || input.fiscal.state,
      originCityIbgeCode:
        input.trip.originCityIbgeCode || input.fiscal.cityIbgeCode,
      destinationCityIbgeCode:
        input.trip.destinationCityIbgeCode || input.fiscal.cityIbgeCode,
      originCityName:
        input.trip.originCityName || input.trip.origin || input.fiscal.cityName,
      destinationCityName:
        input.trip.destinationCityName ||
        input.trip.destination ||
        input.fiscal.cityName,
      originZipCode: input.trip.originZipCode || input.fiscal.zipCode,
      destinationZipCode: input.trip.destinationZipCode || input.fiscal.zipCode,
    };
  }

  private validateIssuePayload(input: {
    vehiclePlate?: string | null;
    driverCpf?: string | null;
    driverName?: string | null;
    rntrc: string;
    route: {
      originState: string;
      destinationState: string;
      originCityIbgeCode: string;
      destinationCityIbgeCode: string;
      originCityName: string;
      destinationCityName: string;
      originZipCode?: string | null;
      destinationZipCode?: string | null;
    };
    documents: FiscalDocumentSource[];
    cargoTotalValue: number;
    cargoQuantity: number;
  }): void {
    if (!this.onlyPlate(input.vehiclePlate || '')) {
      throw new BadRequestException(
        'Veículo de tração sem placa válida para emissão do MDF-e.',
      );
    }

    if (!this.onlyDigits(input.driverCpf || '') || !input.driverName) {
      throw new BadRequestException(
        'Motorista com CPF e nome é obrigatório para emissão do MDF-e.',
      );
    }

    if (!input.rntrc) {
      throw new BadRequestException(
        'RNTRC não encontrado. Preencha CompanyFiscalSettings.rntrc ou cadastre documento RNTRC no veículo/empresa.',
      );
    }

    if (!input.route.originState || !input.route.destinationState) {
      throw new BadRequestException(
        'UF de origem e destino são obrigatórias para emissão do MDF-e.',
      );
    }

    if (
      !this.onlyDigits(input.route.originCityIbgeCode) ||
      !this.onlyDigits(input.route.destinationCityIbgeCode)
    ) {
      throw new BadRequestException(
        'Código IBGE da cidade de origem e destino são obrigatórios para emissão do MDF-e.',
      );
    }

    if (!input.route.originCityName || !input.route.destinationCityName) {
      throw new BadRequestException(
        'Cidade de origem e destino são obrigatórias para emissão do MDF-e.',
      );
    }

    if (input.documents.length === 0) {
      throw new BadRequestException(
        'Nenhum documento fiscal encontrado para a viagem. Cadastre TripFiscalDocument ou informe chaves nos produtos da viagem.',
      );
    }

    if (
      input.documents.some(
        (document) => this.onlyDigits(document.accessKey).length !== 44,
      )
    ) {
      throw new BadRequestException(
        'Todos os documentos fiscais do MDF-e precisam ter chave de acesso com 44 dígitos.',
      );
    }

    if (input.cargoTotalValue <= 0 || input.cargoQuantity <= 0) {
      throw new BadRequestException(
        'Valor e quantidade da carga precisam ser maiores que zero.',
      );
    }
  }

  private resolveVehicleTara(): number {
    return Number(process.env.MDFE_DEFAULT_TRACTION_TARA || 10000);
  }

  private resolveImplementTara(): number {
    return Number(process.env.MDFE_DEFAULT_IMPLEMENT_TARA || 8000);
  }

  private cleanXmlBeforeSign(xml: string): string {
    return String(xml || '')
      .replace(/^\uFEFF/, '')
      .replace(/\r/g, '')
      .replace(/\n/g, '')
      .replace(/\t/g, '')
      .replace(/>\s+</g, '><')
      .trim();
  }


  private getAuthorizationUrl(environment: 'HOMOLOGATION' | 'PRODUCTION') {
    return environment === 'PRODUCTION'
      ? process.env.MDFE_SEFAZ_AUTHORIZATION_URL_PRODUCTION
      : process.env.MDFE_SEFAZ_AUTHORIZATION_URL_HOMOLOGATION;
  }

  private getConsultUrl(environment: 'HOMOLOGATION' | 'PRODUCTION') {
    if (environment === 'PRODUCTION') {
      return (
        process.env.MDFE_SEFAZ_CONSULT_URL_PRODUCTION ||
        process.env.MDFE_SEFAZ_CONSULTA_URL_PRODUCTION
      );
    }

    return (
      process.env.MDFE_SEFAZ_CONSULT_URL_HOMOLOGATION ||
      process.env.MDFE_SEFAZ_CONSULTA_URL_HOMOLOGATION ||
      'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeConsulta/MDFeConsulta.asmx'
    );
  }

  private getEventUrl(environment: 'HOMOLOGATION' | 'PRODUCTION') {
    if (environment === 'PRODUCTION') {
      return (
        process.env.MDFE_SEFAZ_EVENT_URL_PRODUCTION ||
        process.env.MDFE_SEFAZ_RECEPCAO_EVENTO_URL_PRODUCTION
      );
    }

    return (
      process.env.MDFE_SEFAZ_EVENT_URL_HOMOLOGATION ||
      process.env.MDFE_SEFAZ_RECEPCAO_EVENTO_URL_HOMOLOGATION ||
      'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeRecepcaoEvento/MDFeRecepcaoEvento.asmx'
    );
  }

  private async loadPfxBuffer(certificatePfxUrl: string): Promise<Buffer> {
    if (certificatePfxUrl.startsWith('base64:')) {
      return Buffer.from(certificatePfxUrl.replace('base64:', ''), 'base64');
    }

    throw new BadRequestException(
      'Por enquanto, certificatePfxUrl precisa estar no formato base64:<conteudo-do-pfx>.',
    );
  }

  private buildAuthorizationSoapEnvelope(payload: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><mdfeDadosMsg xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoSinc">${payload}</mdfeDadosMsg></soap12:Body></soap12:Envelope>`;
  }

  private buildEventSoapEnvelope(eventXml: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><mdfeDadosMsg xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoEvento">${eventXml}</mdfeDadosMsg></soap12:Body></soap12:Envelope>`;
  }

  private buildConsultSoapEnvelope(consultXml: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><mdfeDadosMsg xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeConsulta">${consultXml}</mdfeDadosMsg></soap12:Body></soap12:Envelope>`;
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

  private onlyDigits(value: string | number | null | undefined): string {
    return String(value || '').replace(/\D/g, '');
  }

  private onlyPlate(value: string | null | undefined): string {
    return String(value || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  }

  private ufCode(uf: string): string {
    const map: Record<string, string> = {
      RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
      MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27',
      SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41',
      SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53',
    };

    return map[String(uf || '').toUpperCase()] ?? '41';
  }
}
