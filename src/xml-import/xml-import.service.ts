import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DebtCategory,
  FuelType,
  Prisma,
  XmlImportBatchStatus,
  XmlInvoiceStatus,
  XmlProcessingStatus,
  XmlProcessingType,
} from '@prisma/client';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import { posix } from 'path';
import { LinkCostRecordDto } from './dto/link-cost-record.dto';
import { LinkFuelRecordDto } from './dto/link-fuel-record.dto';
import { LinkMaintenanceRecordDto } from './dto/link-maintenance-record.dto';
import { PrismaService } from '../prisma/prisma.service';

type ImportXmlZipInput = {
  companyId: string;
  fileName: string;
  zipBuffer: Buffer;
  branchId?: string;
  periodLabel?: string;
};

type XmlDomain = 'FUEL' | 'MAINTENANCE' | 'RETAIL_PRODUCT';

type ImportXmlZipByDomainInput = ImportXmlZipInput & {
  domain: XmlDomain;
  autoProcess?: boolean;
};

type DomainInvoiceFilters = {
  period?: string;
  issuerName?: string;
  number?: string;
  processingStatus?: string;
  dateFrom?: string;
  dateTo?: string;
};

type ListRetailProductImportsFilters = {
  dateFrom?: string;
  dateTo?: string;
  supplier?: string;
  invoiceNumber?: string;
  itemDescription?: string;
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

  async importZipByDomain(input: ImportXmlZipByDomainInput) {
    const baseSummary = await this.importZip(input);
    const { allowedTypes, processKind } = this.getDomainDefinition(input.domain);
    const shouldAutoProcess = input.autoProcess === true;

    const batchInvoices = await this.prisma.xmlInvoice.findMany({
      where: {
        companyId: input.companyId,
        batchId: baseSummary.batchId,
      },
      select: {
        id: true,
        processingType: true,
        processingStatus: true,
      },
    });

    const eligibleInvoices = batchInvoices.filter((invoice) =>
      allowedTypes.includes(invoice.processingType),
    );
    const eligibleDomainInvoices = eligibleInvoices.length;
    const ignoredByDomainFilter = Math.max(
      0,
      baseSummary.importedFiles - eligibleDomainInvoices,
    );

    let autoProcessed = 0;
    let autoProcessErrors = 0;

    if (shouldAutoProcess) {
      for (const invoice of eligibleInvoices) {
        if (invoice.processingStatus === XmlProcessingStatus.PROCESSED) continue;
        if (invoice.processingStatus === XmlProcessingStatus.IGNORED) continue;

        try {
          if (processKind === 'fuel') {
            await this.processInvoiceAsFuel(input.companyId, invoice.id);
          } else if (processKind === 'maintenance') {
            await this.processInvoiceAsMaintenance(input.companyId, invoice.id);
          } else {
            await this.processInvoiceAsRetailProduct(input.companyId, invoice.id);
          }
          autoProcessed += 1;
        } catch (error) {
          autoProcessErrors += 1;
          this.logger.warn(
            `[xml-import] dominio=${input.domain} invoiceId=${invoice.id} falha no processamento: ${
              error instanceof Error ? error.message : 'erro desconhecido'
            }`,
          );
        }
      }
    }

    return {
      ...baseSummary,
      domain: input.domain,
      eligibleDomainInvoices,
      ignoredByDomainFilter,
      processingMode: shouldAutoProcess ? 'AUTO_PROCESSED' : 'SUGGESTED_REVIEW',
      autoProcessed,
      autoProcessErrors,
    };
  }

  async listInvoicesByDomain(
    companyId: string,
    domain: XmlDomain,
    filters: DomainInvoiceFilters = {},
  ) {
    const { allowedTypes } = this.getDomainDefinition(domain);
    const period = String(filters.period || '').trim();
    const issuerName = String(filters.issuerName || '').trim();
    const number = String(filters.number || '').trim();
    const processingStatus = String(filters.processingStatus || '').trim();
    const dateFrom = this.toDate(filters.dateFrom);
    const dateTo = this.toDate(filters.dateTo);

    const issuedAtFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) {
      issuedAtFilter.gte = new Date(
        dateFrom.getFullYear(),
        dateFrom.getMonth(),
        dateFrom.getDate(),
        0,
        0,
        0,
        0,
      );
    }
    if (dateTo) {
      issuedAtFilter.lte = new Date(
        dateTo.getFullYear(),
        dateTo.getMonth(),
        dateTo.getDate(),
        23,
        59,
        59,
        999,
      );
    }

    const periodRange = this.resolvePeriodRange(period);

    return this.prisma.xmlInvoice.findMany({
      where: {
        companyId,
        processingType: { in: allowedTypes },
        ...(issuerName
          ? { issuerName: { contains: issuerName, mode: 'insensitive' } }
          : {}),
        ...(number ? { number: { contains: number, mode: 'insensitive' } } : {}),
        ...(processingStatus
          ? { processingStatus: processingStatus as XmlProcessingStatus }
          : {}),
        ...(Object.keys(issuedAtFilter).length > 0
          ? { issuedAt: issuedAtFilter }
          : {}),
        ...(periodRange
          ? {
              OR: [
                { issuedAt: { gte: periodRange.start, lte: periodRange.end } },
                { folderName: { contains: periodRange.compact, mode: 'insensitive' } },
                { folderName: { contains: periodRange.slash, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
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
        linkedRetailProductImportId: true,
        createdAt: true,
        _count: {
          select: {
            items: true,
          },
        },
      },
    });
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
            linkedRetailProductImportId: true,
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

  async deleteBatchById(companyId: string, batchId: string) {
    const batch = await this.prisma.xmlImportBatch.findFirst({
      where: {
        id: batchId,
        companyId,
      },
      select: {
        id: true,
      },
    });

    if (!batch) {
      throw new NotFoundException('Lote XML nao encontrado para esta empresa.');
    }

    const invoiceIds = (
      await this.prisma.xmlInvoice.findMany({
        where: {
          batchId: batch.id,
          companyId,
        },
        select: {
          id: true,
        },
      })
    ).map((item) => item.id);

    const result = await this.prisma.$transaction(async (tx) => {
      const deletedRetailProductImports =
        invoiceIds.length > 0
          ? await tx.retailProductImport.deleteMany({
              where: {
                companyId,
                xmlInvoiceId: {
                  in: invoiceIds,
                },
              },
            })
          : { count: 0 };

      const deletedInvoices = await tx.xmlInvoice.deleteMany({
        where: {
          batchId: batch.id,
          companyId,
        },
      });

      await tx.xmlImportBatch.delete({
        where: {
          id: batch.id,
        },
      });

      return {
        deletedRetailProductImports: deletedRetailProductImports.count,
        deletedInvoices: deletedInvoices.count,
      };
    });

    this.logger.log(
      `[xml-import] lote removido batchId=${batch.id} companyId=${companyId} invoices=${result.deletedInvoices} retailImports=${result.deletedRetailProductImports}`,
    );

    return {
      batchId: batch.id,
      deleted: true,
      deletedInvoices: result.deletedInvoices,
      deletedRetailProductImports: result.deletedRetailProductImports,
    };
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
        linkedRetailProductImportId: true,
        createdAt: true,
        _count: {
          select: {
            items: true,
          },
        },
      },
    });
  }

  async listRetailProductImports(
    companyId: string,
    filters: ListRetailProductImportsFilters = {},
  ) {
    const dateFrom = this.toDate(filters.dateFrom);
    const dateTo = this.toDate(filters.dateTo);
    const supplier = String(filters.supplier || '').trim();
    const invoiceNumber = String(filters.invoiceNumber || '').trim();
    const itemDescription = String(filters.itemDescription || '').trim();

    const issuedAtFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) {
      issuedAtFilter.gte = new Date(
        dateFrom.getFullYear(),
        dateFrom.getMonth(),
        dateFrom.getDate(),
        0,
        0,
        0,
        0,
      );
    }
    if (dateTo) {
      issuedAtFilter.lte = new Date(
        dateTo.getFullYear(),
        dateTo.getMonth(),
        dateTo.getDate(),
        23,
        59,
        59,
        999,
      );
    }

    return this.prisma.retailProductImport.findMany({
      where: {
        companyId,
        ...(Object.keys(issuedAtFilter).length > 0
          ? { issuedAt: issuedAtFilter }
          : {}),
        ...(supplier
          ? { supplierName: { contains: supplier, mode: 'insensitive' } }
          : {}),
        ...(invoiceNumber
          ? { invoiceNumber: { contains: invoiceNumber, mode: 'insensitive' } }
          : {}),
        ...(itemDescription
          ? {
              items: {
                some: {
                  description: {
                    contains: itemDescription,
                    mode: 'insensitive',
                  },
                },
              },
            }
          : {}),
      },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        supplierName: true,
        supplierDocument: true,
        invoiceNumber: true,
        invoiceSeries: true,
        issuedAt: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        xmlInvoice: {
          select: {
            id: true,
            invoiceKey: true,
            number: true,
            series: true,
            issuedAt: true,
            invoiceStatus: true,
            processingType: true,
            processingStatus: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });
  }

  async getRetailProductImportById(companyId: string, retailImportId: string) {
    const retailImport = await this.prisma.retailProductImport.findFirst({
      where: {
        id: retailImportId,
        companyId,
      },
      select: {
        id: true,
        supplierName: true,
        supplierDocument: true,
        invoiceNumber: true,
        invoiceSeries: true,
        issuedAt: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        xmlInvoice: {
          select: {
            id: true,
            invoiceKey: true,
            number: true,
            series: true,
            issuedAt: true,
            issuerName: true,
            issuerDocument: true,
            recipientName: true,
            recipientDocument: true,
            invoiceStatus: true,
            processingType: true,
            processingStatus: true,
            processedAt: true,
            totalAmount: true,
            protocolNumber: true,
            folderName: true,
            fileName: true,
          },
        },
        items: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            productCode: true,
            description: true,
            quantity: true,
            unitValue: true,
            totalValue: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    if (!retailImport) {
      throw new NotFoundException(
        'Importacao de produtos nao encontrada para esta empresa.',
      );
    }

    return retailImport;
  }

  async deleteInvoices(companyId: string, invoiceIds: string[]) {
    const uniqueIds = Array.from(
      new Set(
        (Array.isArray(invoiceIds) ? invoiceIds : [])
          .map((id) => String(id || '').trim())
          .filter(Boolean),
      ),
    );

    if (uniqueIds.length === 0) {
      throw new BadRequestException('Nenhuma nota informada para exclusao.');
    }

    const existing = await this.prisma.xmlInvoice.findMany({
      where: {
        companyId,
        id: { in: uniqueIds },
      },
      select: { id: true },
    });

    const existingIds = new Set(existing.map((invoice) => invoice.id));
    const notFoundIds = uniqueIds.filter((id) => !existingIds.has(id));

    const deleted = await this.prisma.xmlInvoice.deleteMany({
      where: {
        companyId,
        id: { in: uniqueIds },
      },
    });

    this.logger.log(
      `[xml-import] exclusao em lote companyId=${companyId} requested=${uniqueIds.length} deleted=${deleted.count}`,
    );

    return {
      requested: uniqueIds.length,
      deleted: deleted.count,
      notFound: notFoundIds.length,
      notFoundIds,
    };
  }

  async getInvoiceById(companyId: string, invoiceId: string, includeRawXml = false) {
    const invoice = await this.prisma.xmlInvoice.findFirst({
      where: {
        id: invoiceId,
        companyId,
      },
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
        linkedRetailProductImportId: true,
        createdAt: true,
        updatedAt: true,
        rawXml: includeRawXml,
        items: {
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            id: true,
            productCode: true,
            description: true,
            quantity: true,
            unitValue: true,
            totalValue: true,
            createdAt: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Nota XML nao encontrada para esta empresa.');
    }

    const [linkedFuelRecord, linkedMaintenanceRecord, linkedCost, linkedRetailProductImport] =
      await Promise.all([
      invoice.linkedFuelRecordId
        ? this.prisma.fuelRecord.findUnique({
            where: { id: invoice.linkedFuelRecordId },
            select: {
              id: true,
              vehicleId: true,
              driverId: true,
              km: true,
              fuelDate: true,
              totalValue: true,
            },
          })
        : Promise.resolve(null),
      invoice.linkedMaintenanceRecordId
        ? this.prisma.maintenanceRecord.findUnique({
            where: { id: invoice.linkedMaintenanceRecordId },
            select: {
              id: true,
              vehicleId: true,
              description: true,
              maintenanceDate: true,
              status: true,
              cost: true,
            },
          })
        : Promise.resolve(null),
      invoice.linkedCostId
        ? this.prisma.debt.findUnique({
            where: { id: invoice.linkedCostId },
            select: {
              id: true,
              vehicleId: true,
              category: true,
              amount: true,
              debtDate: true,
              status: true,
            },
          })
        : Promise.resolve(null),
      invoice.linkedRetailProductImportId
        ? this.prisma.retailProductImport.findUnique({
            where: { id: invoice.linkedRetailProductImportId },
            select: {
              id: true,
              supplierName: true,
              supplierDocument: true,
              invoiceNumber: true,
              invoiceSeries: true,
              issuedAt: true,
              totalAmount: true,
              branchId: true,
            },
          })
        : Promise.resolve(null),
      ]);

    return {
      ...invoice,
      linkedFuelRecord,
      linkedMaintenanceRecord,
      linkedCost,
      linkedRetailProductImport,
    };
  }

  async processInvoiceAsFuel(companyId: string, invoiceId: string) {
    const invoice = await this.getProcessableInvoice(companyId, invoiceId);
    const liters = this.sumInvoiceItemQuantity(invoice.items);
    const totalValue = this.decimalToNumber(invoice.totalAmount);
    const fuelType = this.inferFuelTypeFromItems(invoice.items);
    const normalizedInvoiceNumber = this.toText(invoice.invoiceKey) || null;

    const result = await this.prisma.$transaction(async (tx) => {
      const existingFuelRecordId = normalizedInvoiceNumber
        ? await this.findFuelRecordIdByInvoiceNumberTx(tx, normalizedInvoiceNumber)
        : null;

      let createdFuelRecord: { id: string };

      if (existingFuelRecordId) {
        createdFuelRecord = { id: existingFuelRecordId };
      } else {
        try {
          createdFuelRecord = await tx.fuelRecord.create({
            data: {
              invoiceNumber: normalizedInvoiceNumber,
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
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002' &&
            normalizedInvoiceNumber
          ) {
            const concurrentExistingId = await this.findFuelRecordIdByInvoiceNumberTx(
              tx,
              normalizedInvoiceNumber,
            );
            if (concurrentExistingId) {
              createdFuelRecord = { id: concurrentExistingId };
            } else {
              throw new BadRequestException(
                `Nota ${normalizedInvoiceNumber} ja cadastrada em abastecimentos.`,
              );
            }
          } else {
            throw error;
          }
        }
      }

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
        reusedRecord: Boolean(existingFuelRecordId),
      };
    });

    this.logger.log(
      `[xml-import] invoiceId=${invoiceId} tipo=fuel ${
        result.reusedRecord ? 'reaproveitado' : 'criado'
      } fuelRecordId=${result.createdRecordId}`,
    );

    return {
      invoiceId: result.invoice.id,
      processingStatus: result.invoice.processingStatus,
      createdRecordType: 'FUEL_RECORD',
      createdRecordId: result.createdRecordId,
    };
  }

  private async findFuelRecordIdByInvoiceNumberTx(
    tx: any,
    invoiceNumber: string,
  ): Promise<string | null> {
    const normalized = String(invoiceNumber || '').trim();
    if (!normalized) return null;

    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "FuelRecord"
      WHERE "invoiceNumber" = ${normalized}
      LIMIT 1
    `;

    return rows?.[0]?.id || null;
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

  async processInvoiceAsRetailProduct(companyId: string, invoiceId: string) {
    const invoice = await this.getProcessableInvoice(companyId, invoiceId);

    if (invoice.processingType !== XmlProcessingType.RETAIL_PRODUCT) {
      throw new BadRequestException(
        'A nota informada nao esta classificada como produto de loja.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const createdRetailImport = await tx.retailProductImport.create({
        data: {
          companyId,
          branchId: invoice.branchId || null,
          xmlInvoiceId: invoice.id,
          supplierName: invoice.issuerName || null,
          supplierDocument: invoice.issuerDocument || null,
          invoiceNumber: invoice.number || null,
          invoiceSeries: invoice.series || null,
          issuedAt: invoice.issuedAt || null,
          totalAmount: invoice.totalAmount ?? null,
          items: {
            create: invoice.items.map((item) => ({
              productCode: this.toText(item.productCode) || null,
              description: this.toText(item.description) || 'Item sem descricao',
              quantity: this.toNumber(item.quantity) ?? null,
              unitValue: this.toNumber(item.unitValue) ?? null,
              totalValue: this.toNumber(item.totalValue) ?? null,
            })),
          },
        },
        select: { id: true },
      });

      const updatedInvoice = await tx.xmlInvoice.update({
        where: { id: invoice.id },
        data: {
          processingStatus: XmlProcessingStatus.PROCESSED,
          processedAt: new Date(),
          linkedRetailProductImportId: createdRetailImport.id,
        },
        select: {
          id: true,
          processingStatus: true,
          linkedRetailProductImportId: true,
        },
      });

      return {
        invoice: updatedInvoice,
        createdRecordId: createdRetailImport.id,
      };
    });

    this.logger.log(
      `[xml-import] invoiceId=${invoiceId} tipo=retail-product criado retailProductImportId=${result.createdRecordId}`,
    );

    return {
      invoiceId: result.invoice.id,
      processingStatus: result.invoice.processingStatus,
      createdRecordType: 'RETAIL_PRODUCT_IMPORT',
      createdRecordId: result.createdRecordId,
    };
  }

  async ignoreInvoice(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.xmlInvoice.findFirst({
      where: { id: invoiceId, companyId },
      select: {
        id: true,
        processingStatus: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Nota XML nao encontrada para esta empresa.');
    }

    if (invoice.processingStatus === XmlProcessingStatus.PROCESSED) {
      throw new BadRequestException(
        'Nao e permitido ignorar uma nota XML ja processada.',
      );
    }

    const updated = await this.prisma.xmlInvoice.update({
      where: { id: invoice.id },
      data: {
        processingStatus: XmlProcessingStatus.IGNORED,
        processedAt: new Date(),
      },
      select: {
        id: true,
        processingStatus: true,
        processedAt: true,
      },
    });

    this.logger.log(
      `[xml-import] invoiceId=${invoiceId} tipo=ignore status=${updated.processingStatus}`,
    );

    return {
      invoiceId: updated.id,
      processingStatus: updated.processingStatus,
      processedAt: updated.processedAt,
    };
  }

  async completeFuelLink(companyId: string, invoiceId: string, dto: LinkFuelRecordDto) {
    const invoice = await this.getInvoiceForLink(companyId, invoiceId, 'fuel');

    const vehicle = await this.requireVehicleFromCompany(dto.vehicleId, companyId);
    const branchId = dto.branchId || vehicle.branchId;
    await this.validateBranchId(branchId, companyId);

    if (dto.driverId) {
      await this.validateDriverForCompany(dto.driverId, companyId, dto.vehicleId);
    }

    let fuelRecord = await this.prisma.fuelRecord.findUnique({
      where: { id: invoice.linkedFuelRecordId! },
      select: { id: true, vehicleId: true },
    });

    if (!fuelRecord) {
      const ensuredFuelRecord = await this.ensureFuelRecordLinkedFromInvoice(invoice.id);
      if (ensuredFuelRecord) {
        fuelRecord = {
          id: ensuredFuelRecord.id,
          vehicleId: ensuredFuelRecord.vehicleId,
        };
      }
    }

    if (!fuelRecord) {
      throw new NotFoundException('Registro de abastecimento vinculado nao encontrado.');
    }

    if (fuelRecord.vehicleId) {
      throw new BadRequestException('O vínculo do abastecimento já está completo.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedFuel = await tx.fuelRecord.update({
        where: { id: fuelRecord.id },
        data: {
          vehicleId: dto.vehicleId,
          driverId: dto.driverId || null,
          ...(typeof dto.km === 'number' ? { km: dto.km } : {}),
        },
        select: {
          id: true,
          vehicleId: true,
          driverId: true,
          km: true,
        },
      });

      const updatedInvoice = await tx.xmlInvoice.update({
        where: { id: invoice.id },
        data: { branchId },
        select: { id: true, branchId: true },
      });

      return { updatedFuel, updatedInvoice };
    });

    this.logger.log(
      `[xml-import] invoiceId=${invoiceId} tipo=link-fuel fuelRecordId=${updated.updatedFuel.id}`,
    );

    return {
      invoiceId: updated.updatedInvoice.id,
      branchId: updated.updatedInvoice.branchId,
      fuelRecord: updated.updatedFuel,
    };
  }

  async completeMaintenanceLink(
    companyId: string,
    invoiceId: string,
    dto: LinkMaintenanceRecordDto,
  ) {
    const invoice = await this.getInvoiceForLink(companyId, invoiceId, 'maintenance');

    const vehicle = await this.requireVehicleFromCompany(dto.vehicleId, companyId);
    const branchId = dto.branchId || vehicle.branchId;
    await this.validateBranchId(branchId, companyId);

    const maintenanceRecord = await this.prisma.maintenanceRecord.findUnique({
      where: { id: invoice.linkedMaintenanceRecordId! },
      select: { id: true, vehicleId: true, description: true },
    });

    if (!maintenanceRecord) {
      throw new NotFoundException('Registro de manutencao vinculado nao encontrado.');
    }

    if (maintenanceRecord.vehicleId) {
      throw new BadRequestException('O vínculo da manutenção já está completo.');
    }

    const nextDescription = dto.descriptionComplement
      ? `${maintenanceRecord.description}\n${dto.descriptionComplement}`.trim()
      : maintenanceRecord.description;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedMaintenance = await tx.maintenanceRecord.update({
        where: { id: maintenanceRecord.id },
        data: {
          vehicleId: dto.vehicleId,
          description: nextDescription,
        },
        select: {
          id: true,
          vehicleId: true,
          description: true,
        },
      });

      const updatedInvoice = await tx.xmlInvoice.update({
        where: { id: invoice.id },
        data: { branchId },
        select: { id: true, branchId: true },
      });

      return { updatedMaintenance, updatedInvoice };
    });

    this.logger.log(
      `[xml-import] invoiceId=${invoiceId} tipo=link-maintenance maintenanceRecordId=${updated.updatedMaintenance.id}`,
    );

    return {
      invoiceId: updated.updatedInvoice.id,
      branchId: updated.updatedInvoice.branchId,
      maintenanceRecord: updated.updatedMaintenance,
    };
  }

  async completeCostLink(companyId: string, invoiceId: string, dto: LinkCostRecordDto) {
    const invoice = await this.getInvoiceForLink(companyId, invoiceId, 'cost');

    const debt = await this.prisma.debt.findUnique({
      where: { id: invoice.linkedCostId! },
      select: { id: true, vehicleId: true, category: true },
    });

    if (!debt) {
      throw new NotFoundException('Registro de custo vinculado nao encontrado.');
    }

    const nextVehicleId = dto.vehicleId || null;
    if (nextVehicleId) {
      const vehicle = await this.requireVehicleFromCompany(nextVehicleId, companyId);
      const branchToValidate = dto.branchId || vehicle.branchId;
      await this.validateBranchId(branchToValidate, companyId);
    } else if (dto.branchId) {
      await this.validateBranchId(dto.branchId, companyId);
    }

    const isAlreadyComplete =
      Boolean(debt.vehicleId) &&
      (invoice.branchId ? true : false);

    if (isAlreadyComplete) {
      throw new BadRequestException('O vínculo do custo já está completo.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedDebt = await tx.debt.update({
        where: { id: debt.id },
        data: {
          ...(nextVehicleId ? { vehicleId: nextVehicleId } : {}),
          ...(dto.category ? { category: dto.category } : {}),
        },
        select: {
          id: true,
          vehicleId: true,
          category: true,
        },
      });

      const updatedInvoice = await tx.xmlInvoice.update({
        where: { id: invoice.id },
        data: {
          ...(dto.branchId ? { branchId: dto.branchId } : {}),
        },
        select: { id: true, branchId: true },
      });

      return { updatedDebt, updatedInvoice };
    });

    this.logger.log(
      `[xml-import] invoiceId=${invoiceId} tipo=link-cost costId=${updated.updatedDebt.id}`,
    );

    return {
      invoiceId: updated.updatedInvoice.id,
      branchId: updated.updatedInvoice.branchId,
      costRecord: updated.updatedDebt,
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
        issuerDocument: true,
        totalAmount: true,
        branchId: true,
        series: true,
        processingType: true,
        processingStatus: true,
        items: {
          select: {
            description: true,
            quantity: true,
            productCode: true,
            unitValue: true,
            totalValue: true,
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

  private async getInvoiceForLink(
    companyId: string,
    invoiceId: string,
    target: 'fuel' | 'maintenance' | 'cost',
  ) {
    const normalizedInvoiceRef = String(invoiceId || '').trim();
    const invoice = await this.prisma.xmlInvoice.findFirst({
      where: {
        companyId,
        OR: [{ id: normalizedInvoiceRef }, { invoiceKey: normalizedInvoiceRef }],
      },
      select: {
        id: true,
        invoiceKey: true,
        issuedAt: true,
        issuerName: true,
        totalAmount: true,
        branchId: true,
        linkedFuelRecordId: true,
        linkedMaintenanceRecordId: true,
        linkedCostId: true,
        items: {
          select: {
            description: true,
            quantity: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Nota XML nao encontrada para esta empresa.');
    }

    if (target === 'fuel' && !invoice.linkedFuelRecordId) {
      throw new BadRequestException('Esta nota nao possui registro de abastecimento vinculado.');
    }

    if (target === 'maintenance' && !invoice.linkedMaintenanceRecordId) {
      throw new BadRequestException('Esta nota nao possui registro de manutencao vinculado.');
    }

    if (target === 'cost' && !invoice.linkedCostId) {
      throw new BadRequestException('Esta nota nao possui registro de custo vinculado.');
    }

    return invoice;
  }

  private async ensureFuelRecordLinkedFromInvoice(invoiceId: string) {
    const invoice = await this.prisma.xmlInvoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        invoiceKey: true,
        issuedAt: true,
        issuerName: true,
        totalAmount: true,
        linkedFuelRecordId: true,
        items: {
          select: {
            description: true,
            quantity: true,
          },
        },
      },
    });

    if (!invoice) return null;

    if (invoice.linkedFuelRecordId) {
      const linked = await this.prisma.fuelRecord.findUnique({
        where: { id: invoice.linkedFuelRecordId },
        select: { id: true, vehicleId: true },
      });
      if (linked) return linked;
    }

    const normalizedInvoiceNumber = this.toText(invoice.invoiceKey) || null;
    if (!normalizedInvoiceNumber) return null;

    const existing = await this.prisma.fuelRecord.findFirst({
      where: { invoiceNumber: normalizedInvoiceNumber },
      select: { id: true, vehicleId: true },
    });

    if (existing) {
      await this.prisma.xmlInvoice.update({
        where: { id: invoice.id },
        data: { linkedFuelRecordId: existing.id },
      });
      return existing;
    }

    const liters = this.sumInvoiceItemQuantity(invoice.items as any[]);
    const totalValue = this.decimalToNumber(invoice.totalAmount as any);
    const fuelType = this.inferFuelTypeFromItems(invoice.items as any[]);

    try {
      const created = await this.prisma.fuelRecord.create({
        data: {
          invoiceNumber: normalizedInvoiceNumber,
          liters,
          totalValue,
          km: 0,
          station: invoice.issuerName || 'Fornecedor nao informado',
          fuelType,
          fuelDate: invoice.issuedAt || new Date(),
          vehicleId: null,
          driverId: null,
        },
        select: { id: true, vehicleId: true },
      });

      await this.prisma.xmlInvoice.update({
        where: { id: invoice.id },
        data: { linkedFuelRecordId: created.id },
      });

      return created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const concurrentExisting = await this.prisma.fuelRecord.findFirst({
          where: { invoiceNumber: normalizedInvoiceNumber },
          select: { id: true, vehicleId: true },
        });
        if (concurrentExisting) {
          await this.prisma.xmlInvoice.update({
            where: { id: invoice.id },
            data: { linkedFuelRecordId: concurrentExisting.id },
          });
          return concurrentExisting;
        }
      }
      throw error;
    }
  }

  private async requireVehicleFromCompany(vehicleId: string, companyId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        branch: {
          companyId,
        },
      },
      select: {
        id: true,
        branchId: true,
      },
    });

    if (!vehicle) {
      throw new BadRequestException('Veiculo invalido para esta empresa.');
    }

    return vehicle;
  }

  private async validateBranchId(branchId: string, companyId: string) {
    if (!branchId) return;
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, companyId },
      select: { id: true },
    });
    if (!branch) {
      throw new BadRequestException('Filial invalida para esta empresa.');
    }
  }

  private async validateDriverForCompany(
    driverId: string,
    companyId: string,
    vehicleId: string,
  ) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        vehicleId: true,
        vehicle: {
          select: {
            id: true,
            branch: {
              select: {
                companyId: true,
              },
            },
          },
        },
      },
    });

    if (!driver) {
      throw new BadRequestException('Motorista nao encontrado.');
    }

    if (
      driver.vehicle?.branch?.companyId &&
      driver.vehicle.branch.companyId !== companyId
    ) {
      throw new BadRequestException('Motorista invalido para esta empresa.');
    }

    if (driver.vehicleId && driver.vehicleId !== vehicleId) {
      throw new BadRequestException(
        'Motorista vinculado a outro veiculo. Selecione um motorista compativel.',
      );
    }
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

    const retailProductKeywords = [
      'PERFUMARIA',
      'SHAMPOO',
      'SABONETE',
      'DESODORANTE',
      'BALA',
      'REFRIGERANTE',
      'BEBIDA',
      'SALGADINHO',
      'CHOCOLATE',
      'CONVENIENCIA',
      'HIGIENE',
      'LIMPEZA',
      'ACESSORIO',
      'UTILIDADE',
    ];
    if (hasKeyword(retailProductKeywords)) {
      this.logger.log('[xml-import] tipo identificado: RETAIL_PRODUCT');
      return XmlProcessingType.RETAIL_PRODUCT;
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

  private getDomainDefinition(domain: XmlDomain): {
    allowedTypes: XmlProcessingType[];
    processKind: 'fuel' | 'maintenance' | 'retail';
  } {
    if (domain === 'FUEL') {
      return {
        allowedTypes: [XmlProcessingType.FUEL],
        processKind: 'fuel',
      };
    }
    if (domain === 'MAINTENANCE') {
      return {
        allowedTypes: [XmlProcessingType.PRODUCT, XmlProcessingType.SERVICE],
        processKind: 'maintenance',
      };
    }
    return {
      allowedTypes: [XmlProcessingType.RETAIL_PRODUCT],
      processKind: 'retail',
    };
  }

  private resolvePeriodRange(period: string): {
    start: Date;
    end: Date;
    compact: string;
    slash: string;
  } | null {
    const normalized = String(period || '').trim();
    if (!normalized) return null;

    const match = normalized.match(/^(\d{4})[\/-]?(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
    if (month < 1 || month > 12) return null;

    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    return {
      start,
      end,
      compact: `${String(year)}${String(month).padStart(2, '0')}`,
      slash: `${String(year)}/${String(month).padStart(2, '0')}`,
    };
  }
}
