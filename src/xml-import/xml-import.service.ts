import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DebtCategory,
  FuelType,
  XmlImportBatchStatus,
  XmlInvoiceStatus,
  XmlProcessingStatus,
  XmlProcessingType,
} from '@prisma/client';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import { posix } from 'path';
import { PrismaService } from '../prisma/prisma.service';

type ImportXmlZipInput = {
  companyId: string;
  fileName: string;
  zipBuffer: Buffer;
  branchId?: string;
  periodLabel?: string;
};

type ParsedXmlInvoice = {
  invoiceKey: string;
  number?: string;
  series?: string;
  issuedAt?: Date;
  issuerName?: string;
  issuerDocument?: string;
  recipientName?: string;
  recipientDocument?: string;
  totalAmount?: number;
  protocolNumber?: string;
  invoiceStatus: XmlInvoiceStatus;
  items: Array<{
    productCode?: string;
    description: string;
    quantity?: number;
    unitValue?: number;
    totalValue?: number;
  }>;
};

@Injectable()
export class XmlImportService {
  private readonly logger = new Logger(XmlImportService.name);
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseTagValue: false,
    trimValues: true,
    removeNSPrefix: true,
  });

  constructor(private readonly prisma: PrismaService) {}

  async importZip(input: ImportXmlZipInput) {
    const companyId = String(input.companyId || '').trim();
    if (!companyId) {
      throw new BadRequestException('companyId obrigatorio para importacao.');
    }

    if (!input.zipBuffer || input.zipBuffer.length === 0) {
      throw new BadRequestException('Arquivo ZIP invalido ou vazio.');
    }

    if (input.branchId) {
      await this.ensureBranchBelongsToCompany(input.branchId, companyId);
    }

    let zip: AdmZip;
    try {
      zip = new AdmZip(input.zipBuffer);
    } catch {
      throw new BadRequestException('Nao foi possivel ler o ZIP enviado.');
    }

    const xmlEntries = zip
      .getEntries()
      .filter((entry) => !entry.isDirectory && entry.entryName.toLowerCase().endsWith('.xml'));

    if (xmlEntries.length === 0) {
      throw new BadRequestException('Nenhum arquivo XML encontrado no ZIP.');
    }

    const batch = await this.prisma.xmlImportBatch.create({
      data: {
        companyId,
        branchId: input.branchId || null,
        fileName: input.fileName || 'importacao.zip',
        periodLabel: input.periodLabel || null,
        status: XmlImportBatchStatus.PROCESSING,
        totalFiles: xmlEntries.length,
        importedFiles: 0,
        duplicateFiles: 0,
        errorFiles: 0,
      },
    });

    this.logger.log(
      `[xml-import] lote iniciado batchId=${batch.id} companyId=${companyId} totalFiles=${xmlEntries.length}`,
    );

    let importedFiles = 0;
    let duplicateFiles = 0;
    let errorFiles = 0;

    for (const entry of xmlEntries) {
      const fileName = posix.basename(entry.entryName);
      const folderName = this.extractFolderName(entry.entryName);
      try {
        const xmlRaw = entry.getData().toString('utf-8');
        const parsedInvoice = this.parseNfeXml(xmlRaw);

        const alreadyImported = await this.prisma.xmlInvoice.findUnique({
          where: { invoiceKey: parsedInvoice.invoiceKey },
          select: { id: true },
        });

        if (alreadyImported) {
          duplicateFiles += 1;
          continue;
        }
        const processingType = this.classifyXmlInvoice(
          parsedInvoice.items,
          parsedInvoice.issuerName,
        );
        const processingStatus = XmlProcessingStatus.SUGGESTED;

        await this.prisma.xmlInvoice.create({
          data: {
            batchId: batch.id,
            companyId,
            branchId: input.branchId || null,
            fileName,
            folderName,
            invoiceKey: parsedInvoice.invoiceKey,
            number: parsedInvoice.number || null,
            series: parsedInvoice.series || null,
            issuedAt: parsedInvoice.issuedAt || null,
            issuerName: parsedInvoice.issuerName || null,
            issuerDocument: parsedInvoice.issuerDocument || null,
            recipientName: parsedInvoice.recipientName || null,
            recipientDocument: parsedInvoice.recipientDocument || null,
            totalAmount: parsedInvoice.totalAmount ?? null,
            protocolNumber: parsedInvoice.protocolNumber || null,
            invoiceStatus: parsedInvoice.invoiceStatus,
            processingType,
            processingStatus,
            processedAt: null,
            rawXml: xmlRaw,
            items: {
              create: parsedInvoice.items.map((item) => ({
                productCode: item.productCode || null,
                description: item.description,
                quantity: item.quantity ?? null,
                unitValue: item.unitValue ?? null,
                totalValue: item.totalValue ?? null,
              })),
            },
          },
        });

        importedFiles += 1;
      } catch (error) {
        errorFiles += 1;
        this.logger.warn(
          `[xml-import] erro no arquivo=${entry.entryName} motivo=${
            error instanceof Error ? error.message : 'erro desconhecido'
          }`,
        );
      }
    }

    const finalStatus =
      errorFiles > 0 ? XmlImportBatchStatus.COMPLETED_WITH_ERRORS : XmlImportBatchStatus.COMPLETED;

    const updatedBatch = await this.prisma.xmlImportBatch.update({
      where: { id: batch.id },
      data: {
        status: finalStatus,
        importedFiles,
        duplicateFiles,
        errorFiles,
      },
    });

    this.logger.log(
      `[xml-import] lote finalizado batchId=${batch.id} imported=${importedFiles} duplicate=${duplicateFiles} errors=${errorFiles}`,
    );

    return {
      batchId: updatedBatch.id,
      status: updatedBatch.status,
      totalFiles: updatedBatch.totalFiles,
      importedFiles: updatedBatch.importedFiles,
      duplicateFiles: updatedBatch.duplicateFiles,
      errorFiles: updatedBatch.errorFiles,
    };
  }

  async listBatches(companyId: string) {
    return this.prisma.xmlImportBatch.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        periodLabel: true,
        status: true,
        totalFiles: true,
        importedFiles: true,
        duplicateFiles: true,
        errorFiles: true,
        createdAt: true,
        updatedAt: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getBatchById(companyId: string, batchId: string) {
    const batch = await this.prisma.xmlImportBatch.findFirst({
      where: {
        id: batchId,
        companyId,
      },
      select: {
        id: true,
        fileName: true,
        periodLabel: true,
        status: true,
        totalFiles: true,
        importedFiles: true,
        duplicateFiles: true,
        errorFiles: true,
        createdAt: true,
        updatedAt: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        invoices: {
          orderBy: { issuedAt: 'desc' },
          select: {
            id: true,
            fileName: true,
            folderName: true,
            invoiceKey: true,
            number: true,
            series: true,
            issuedAt: true,
            issuerName: true,
            issuerDocument: true,
            recipientName: true,
            recipientDocument: true,
            totalAmount: true,
            protocolNumber: true,
            invoiceStatus: true,
            processingType: true,
            processingStatus: true,
            processedAt: true,
            linkedFuelRecordId: true,
            linkedMaintenanceRecordId: true,
            linkedCostId: true,
            createdAt: true,
            _count: {
              select: {
                items: true,
              },
            },
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Lote XML nao encontrado para esta empresa.');
    }

    return batch;
  }

  async listInvoices(companyId: string, batchId?: string) {
    return this.prisma.xmlInvoice.findMany({
      where: {
        companyId,
        ...(batchId ? { batchId } : {}),
      },
      orderBy: { issuedAt: 'desc' },
      select: {
        id: true,
        batchId: true,
        fileName: true,
        folderName: true,
        invoiceKey: true,
        number: true,
        series: true,
        issuedAt: true,
        issuerName: true,
        issuerDocument: true,
        recipientName: true,
        recipientDocument: true,
        totalAmount: true,
        protocolNumber: true,
        invoiceStatus: true,
        processingType: true,
        processingStatus: true,
        processedAt: true,
        linkedFuelRecordId: true,
        linkedMaintenanceRecordId: true,
        linkedCostId: true,
        createdAt: true,
        _count: {
          select: {
            items: true,
          },
        },
      },
    });
  }

  async processInvoiceAsFuel(companyId: string, invoiceId: string) {
    const invoice = await this.getProcessableInvoice(companyId, invoiceId);
    const liters = this.sumInvoiceItemQuantity(invoice.items);
    const totalValue = this.decimalToNumber(invoice.totalAmount);
    const fuelType = this.inferFuelTypeFromItems(invoice.items);

    const result = await this.prisma.$transaction(async (tx) => {
      const createdFuelRecord = await tx.fuelRecord.create({
        data: {
          invoiceNumber: invoice.invoiceKey,
          liters,
          totalValue,
          km: 0,
          station: invoice.issuerName || 'Fornecedor nao informado',
          fuelType,
          fuelDate: invoice.issuedAt || new Date(),
          vehicleId: null,
          driverId: null,
        },
        select: { id: true },
      });

      const updatedInvoice = await tx.xmlInvoice.update({
        where: { id: invoice.id },
        data: {
          processingStatus: XmlProcessingStatus.PROCESSED,
          processedAt: new Date(),
          linkedFuelRecordId: createdFuelRecord.id,
        },
        select: { id: true, processingStatus: true, linkedFuelRecordId: true },
      });

      return {
        invoice: updatedInvoice,
        createdRecordId: createdFuelRecord.id,
      };
    });

    this.logger.log(
      `[xml-import] invoiceId=${invoiceId} tipo=fuel criado fuelRecordId=${result.createdRecordId}`,
    );

    return {
      invoiceId: result.invoice.id,
      processingStatus: result.invoice.processingStatus,
      createdRecordType: 'FUEL_RECORD',
      createdRecordId: result.createdRecordId,
    };
  }

  async processInvoiceAsMaintenance(companyId: string, invoiceId: string) {
    const invoice = await this.getProcessableInvoice(companyId, invoiceId);
    const totalValue = this.decimalToNumber(invoice.totalAmount);
    const partsReplaced = invoice.items
      .map((item) => this.toText(item.description))
      .filter((value): value is string => Boolean(value))
      .slice(0, 15);

    const result = await this.prisma.$transaction(async (tx) => {
      const createdMaintenance = await tx.maintenanceRecord.create({
        data: {
          type:
            invoice.processingType === XmlProcessingType.SERVICE
              ? 'Servico'
              : 'Produto',
          description:
            `NF-e ${invoice.number || '-'} - ${invoice.issuerName || 'Fornecedor'}`.trim(),
          partsReplaced,
          workshop: invoice.issuerName || null,
          responsible: null,
          cost: totalValue,
          km: 0,
          maintenanceDate: invoice.issuedAt || new Date(),
          status: 'Pendente',
          notes: `Processado da NF-e ${invoice.invoiceKey}`,
          vehicleId: null,
        },
        select: { id: true },
      });

      const updatedInvoice = await tx.xmlInvoice.update({
        where: { id: invoice.id },
        data: {
          processingStatus: XmlProcessingStatus.PROCESSED,
          processedAt: new Date(),
          linkedMaintenanceRecordId: createdMaintenance.id,
        },
        select: { id: true, processingStatus: true, linkedMaintenanceRecordId: true },
      });

      return {
        invoice: updatedInvoice,
        createdRecordId: createdMaintenance.id,
      };
    });

    this.logger.log(
      `[xml-import] invoiceId=${invoiceId} tipo=maintenance criado maintenanceRecordId=${result.createdRecordId}`,
    );

    return {
      invoiceId: result.invoice.id,
      processingStatus: result.invoice.processingStatus,
      createdRecordType: 'MAINTENANCE_RECORD',
      createdRecordId: result.createdRecordId,
    };
  }

  async processInvoiceAsCost(companyId: string, invoiceId: string) {
    const invoice = await this.getProcessableInvoice(companyId, invoiceId);
    const totalValue = this.decimalToNumber(invoice.totalAmount);
    const referenceMonth = invoice.issuedAt
      ? `${invoice.issuedAt.getFullYear()}-${String(invoice.issuedAt.getMonth() + 1).padStart(2, '0')}`
      : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const createdCost = await tx.debt.create({
        data: {
          description: `NF-e ${invoice.number || '-'} - ${invoice.issuerName || 'Fornecedor'}`,
          category: DebtCategory.OTHER,
          amount: totalValue,
          points: 0,
          debtDate: invoice.issuedAt || new Date(),
          dueDate: null,
          referenceMonth,
          creditor: invoice.issuerName || null,
          isRecurring: false,
          status: 'Pendente',
          vehicleId: null,
        },
        select: { id: true },
      });

      const updatedInvoice = await tx.xmlInvoice.update({
        where: { id: invoice.id },
        data: {
          processingStatus: XmlProcessingStatus.PROCESSED,
          processedAt: new Date(),
          linkedCostId: createdCost.id,
        },
        select: { id: true, processingStatus: true, linkedCostId: true },
      });

      return {
        invoice: updatedInvoice,
        createdRecordId: createdCost.id,
      };
    });

    this.logger.log(
      `[xml-import] invoiceId=${invoiceId} tipo=cost criado costId=${result.createdRecordId}`,
    );

    return {
      invoiceId: result.invoice.id,
      processingStatus: result.invoice.processingStatus,
      createdRecordType: 'COST_RECORD',
      createdRecordId: result.createdRecordId,
    };
  }

  private async getProcessableInvoice(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.xmlInvoice.findFirst({
      where: { id: invoiceId, companyId },
      select: {
        id: true,
        invoiceKey: true,
        number: true,
        issuedAt: true,
        issuerName: true,
        totalAmount: true,
        processingType: true,
        processingStatus: true,
        items: {
          select: {
            description: true,
            quantity: true,
            productCode: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Nota XML nao encontrada para esta empresa.');
    }

    if (invoice.processingStatus === XmlProcessingStatus.PROCESSED) {
      throw new BadRequestException('Esta nota XML ja foi processada.');
    }

    return invoice;
  }

  private async ensureBranchBelongsToCompany(branchId: string, companyId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, companyId },
      select: { id: true },
    });

    if (!branch) {
      throw new NotFoundException('Filial nao encontrada para esta empresa.');
    }
  }

  private extractFolderName(entryName: string) {
    const normalized = String(entryName || '').replaceAll('\\', '/');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length <= 1) return null;
    return parts.slice(0, -1).join('/');
  }

  private parseNfeXml(rawXml: string): ParsedXmlInvoice {
    const parsed = this.xmlParser.parse(rawXml);
    const nfeProc = parsed?.nfeProc || parsed?.NFeProc || parsed;
    const nfe = nfeProc?.NFe || parsed?.NFe;
    const infNFe = nfe?.infNFe || parsed?.infNFe;
    const protNFe = nfeProc?.protNFe || parsed?.protNFe;
    const infProt = protNFe?.infProt || parsed?.infProt;

    if (!infNFe) {
      throw new Error('XML sem estrutura de NF-e valida (infNFe ausente).');
    }

    const ide = infNFe?.ide || {};
    const emit = infNFe?.emit || {};
    const dest = infNFe?.dest || {};
    const icmsTot = infNFe?.total?.ICMSTot || {};

    const keyFromId = this.toInvoiceKey(infNFe?.Id);
    const keyFromProtocol = this.onlyDigits(infProt?.chNFe);
    const invoiceKey = keyFromProtocol || keyFromId;

    if (!invoiceKey || invoiceKey.length < 20) {
      throw new Error('Chave da NF-e nao identificada no XML.');
    }

    const itemsRaw = this.toArray(infNFe?.det);
    const items = itemsRaw
      .map((det: any) => det?.prod)
      .filter(Boolean)
      .map((prod: any) => ({
        productCode: this.toText(prod?.cProd),
        description: this.toText(prod?.xProd) || 'Item sem descricao',
        quantity: this.toNumber(prod?.qCom),
        unitValue: this.toNumber(prod?.vUnCom),
        totalValue: this.toNumber(prod?.vProd),
      }));

    return {
      invoiceKey,
      number: this.toText(ide?.nNF),
      series: this.toText(ide?.serie),
      issuedAt: this.toDate(ide?.dhEmi || ide?.dEmi),
      issuerName: this.toText(emit?.xNome),
      issuerDocument: this.onlyDigits(emit?.CNPJ || emit?.CPF),
      recipientName: this.toText(dest?.xNome),
      recipientDocument: this.onlyDigits(dest?.CNPJ || dest?.CPF),
      totalAmount: this.toNumber(icmsTot?.vNF),
      protocolNumber: this.toText(infProt?.nProt),
      invoiceStatus: this.mapInvoiceStatus(infProt?.cStat),
      items,
    };
  }

  private classifyXmlInvoice(
    items: ParsedXmlInvoice['items'],
    issuerName?: string,
  ): XmlProcessingType {
    const normalizedSearchBase = this.normalizeForClassification([
      issuerName || '',
      ...items.map((item) => `${item.productCode || ''} ${item.description || ''}`),
    ]);

    const hasKeyword = (keywords: string[]) =>
      keywords.some((keyword) => normalizedSearchBase.includes(keyword));

    const fuelKeywords = ['GASOLINA', 'ETANOL', 'DIESEL', 'S10'];
    if (hasKeyword(fuelKeywords)) {
      this.logger.log('[xml-import] tipo identificado: FUEL');
      return XmlProcessingType.FUEL;
    }

    const productKeywords = ['FILTRO', 'PNEU', 'OLEO', 'LUBRIFICANTE', 'PECA'];
    if (hasKeyword(productKeywords)) {
      this.logger.log('[xml-import] tipo identificado: PRODUCT');
      return XmlProcessingType.PRODUCT;
    }

    const serviceKeywords = ['SERVICO', 'MAO DE OBRA', 'MANUTENCAO'];
    if (hasKeyword(serviceKeywords)) {
      this.logger.log('[xml-import] tipo identificado: SERVICE');
      return XmlProcessingType.SERVICE;
    }

    this.logger.log('[xml-import] tipo identificado: UNKNOWN (fallback)');
    return XmlProcessingType.UNKNOWN;
  }

  private normalizeForClassification(texts: string[]): string {
    return texts
      .join(' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();
  }

  private sumInvoiceItemQuantity(
    items: Array<{ quantity: unknown }>,
  ): number {
    const total = items.reduce((acc, item) => {
      const quantity = this.toNumber(item.quantity);
      return acc + (quantity ?? 0);
    }, 0);
    return total > 0 ? total : 0;
  }

  private inferFuelTypeFromItems(
    items: Array<{ description: unknown; productCode: unknown }>,
  ): FuelType {
    const normalized = this.normalizeForClassification(
      items.map(
        (item) =>
          `${this.toText(item.productCode) || ''} ${this.toText(item.description) || ''}`,
      ),
    );

    if (normalized.includes('ETANOL')) return FuelType.ETHANOL;
    if (normalized.includes('DIESEL') || normalized.includes('S10')) {
      return FuelType.DIESEL;
    }
    if (normalized.includes('GNV') || normalized.includes('CNG')) {
      return FuelType.CNG;
    }
    return FuelType.GASOLINE;
  }

  private decimalToNumber(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private mapInvoiceStatus(cStat: unknown): XmlInvoiceStatus {
    const code = String(cStat || '').trim();
    if (code === '100' || code === '150') return XmlInvoiceStatus.AUTHORIZED;
    if (code === '101' || code === '151' || code === '155') return XmlInvoiceStatus.CANCELED;
    if (code === '110' || code === '301' || code === '302' || code === '303') {
      return XmlInvoiceStatus.DENIED;
    }
    return XmlInvoiceStatus.UNKNOWN;
  }

  private toArray<T>(value: T | T[] | undefined | null): T[] {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
  }

  private toText(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    const normalized = String(value).trim();
    return normalized || undefined;
  }

  private toDate(value: unknown): Date | undefined {
    const normalized = this.toText(value);
    if (!normalized) return undefined;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private toNumber(value: unknown): number | undefined {
    if (value === undefined || value === null) return undefined;
    const text = String(value).trim();
    if (!text) return undefined;
    const normalized = text.includes(',')
      ? text.replaceAll('.', '').replace(',', '.')
      : text;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private onlyDigits(value: unknown): string | undefined {
    const text = this.toText(value);
    if (!text) return undefined;
    const digits = text.replace(/\D+/g, '');
    return digits || undefined;
  }

  private toInvoiceKey(idValue: unknown): string | undefined {
    const text = this.toText(idValue);
    if (!text) return undefined;
    const noPrefix = text.toUpperCase().startsWith('NFE') ? text.slice(3) : text;
    return this.onlyDigits(noPrefix);
  }
}
