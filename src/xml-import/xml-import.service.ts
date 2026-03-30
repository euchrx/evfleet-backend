import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { XmlImportBatchStatus, XmlInvoiceStatus } from '@prisma/client';
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
        createdAt: true,
        _count: {
          select: {
            items: true,
          },
        },
      },
    });
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
