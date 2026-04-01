import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyDeletionBackupResult } from '../company-deletion.types';

type CompanyBackupPayload = {
  metadata: {
    generatedAt: string;
    actorUserId: string;
    companyId: string;
    backupType: 'company-delete-with-backup';
    storageDriver: 'local-disk';
    missingRelations: string[];
  };
  company: unknown;
  branches: unknown[];
  users: unknown[];
  subscriptions: unknown[];
  payments: unknown[];
  webhookEvents: unknown[];
  vehicles: unknown[];
  vehicleProfilePhotos: unknown[];
  vehicleChangeLogs: unknown[];
  drivers: unknown[];
  maintenanceRecords: unknown[];
  maintenancePlans: unknown[];
  debts: unknown[];
  fuelRecords: unknown[];
  trips: unknown[];
  vehicleDocuments: unknown[];
  tires: unknown[];
  tireReadings: unknown[];
  xmlImportBatches: unknown[];
  xmlInvoices: unknown[];
  xmlInvoiceItems: unknown[];
  retailProductImports: unknown[];
  retailProductImportItems: unknown[];
  references: Record<string, unknown>;
};

@Injectable()
export class CompanyBackupService {
  constructor(private readonly prisma: PrismaService) {}

  async createBackup(
    companyId: string,
    actorUserId: string,
  ): Promise<CompanyDeletionBackupResult> {
    const generatedAt = new Date().toISOString();
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new Error(
        'A empresa não foi encontrada no momento de gerar o backup.',
      );
    }

    const branches = await this.prisma.branch.findMany({ where: { companyId } });
    const branchIds = branches.map((item) => item.id);

    const vehicles = branchIds.length
      ? await this.prisma.vehicle.findMany({
          where: { branchId: { in: branchIds } },
        })
      : [];
    const vehicleIds = vehicles.map((item) => item.id);

    const drivers = vehicleIds.length
      ? await this.prisma.driver.findMany({
          where: { vehicleId: { in: vehicleIds } },
        })
      : [];

    const maintenanceRecords = vehicleIds.length
      ? await this.prisma.maintenanceRecord.findMany({
          where: { vehicleId: { in: vehicleIds } },
        })
      : [];

    const maintenancePlans = vehicleIds.length
      ? await this.prisma.maintenancePlan.findMany({
          where: { vehicleId: { in: vehicleIds } },
        })
      : [];

    const debts = vehicleIds.length
      ? await this.prisma.debt.findMany({
          where: { vehicleId: { in: vehicleIds } },
        })
      : [];

    const fuelRecords = vehicleIds.length
      ? await this.prisma.fuelRecord.findMany({
          where: { vehicleId: { in: vehicleIds } },
        })
      : [];

    const trips = vehicleIds.length
      ? await this.prisma.trip.findMany({
          where: { vehicleId: { in: vehicleIds } },
        })
      : [];

    const vehicleDocuments = vehicleIds.length
      ? await this.prisma.vehicleDocument.findMany({
          where: { vehicleId: { in: vehicleIds } },
        })
      : [];

    const tires = vehicleIds.length
      ? await this.prisma.tire.findMany({
          where: { vehicleId: { in: vehicleIds } },
        })
      : [];
    const tireIds = tires.map((item) => item.id);

    const tireReadings =
      tireIds.length || vehicleIds.length
        ? await this.prisma.tireReading.findMany({
            where: {
              OR: [
                ...(tireIds.length ? [{ tireId: { in: tireIds } }] : []),
                ...(vehicleIds.length ? [{ vehicleId: { in: vehicleIds } }] : []),
              ],
            },
          })
        : [];

    const vehicleChangeLogs = vehicleIds.length
      ? await this.prisma.vehicleChangeLog.findMany({
          where: { vehicleId: { in: vehicleIds } },
        })
      : [];

    const vehicleProfilePhotos = vehicleIds.length
      ? await this.prisma.vehicleProfilePhoto.findMany({
          where: { vehicleId: { in: vehicleIds } },
        })
      : [];

    const users = await this.prisma.user.findMany({ where: { companyId } });
    const subscriptions = await this.prisma.subscription.findMany({
      where: { companyId },
    });
    const subscriptionIds = subscriptions.map((item) => item.id);

    const payments = await this.prisma.payment.findMany({ where: { companyId } });
    const webhookEvents = await this.prisma.webhookEvent.findMany({
      where: {
        OR: [
          { companyId },
          ...(subscriptionIds.length
            ? [{ subscriptionId: { in: subscriptionIds } }]
            : []),
        ],
      },
    });

    const xmlImportBatches = await this.prisma.xmlImportBatch.findMany({
      where: { companyId },
    });
    const batchIds = xmlImportBatches.map((item) => item.id);

    const xmlInvoices = await this.prisma.xmlInvoice.findMany({
      where: { companyId },
    });
    const invoiceIds = xmlInvoices.map((item) => item.id);

    const xmlInvoiceItems = invoiceIds.length
      ? await this.prisma.xmlInvoiceItem.findMany({
          where: { invoiceId: { in: invoiceIds } },
        })
      : [];

    const retailProductImports = await this.prisma.retailProductImport.findMany({
      where: { companyId },
    });
    const retailImportIds = retailProductImports.map((item) => item.id);

    const retailProductImportItems = retailImportIds.length
      ? await this.prisma.retailProductImportItem.findMany({
          where: { retailProductImportId: { in: retailImportIds } },
        })
      : [];

    const payload: CompanyBackupPayload = {
      metadata: {
        generatedAt,
        actorUserId,
        companyId,
        backupType: 'company-delete-with-backup',
        storageDriver: 'local-disk',
        missingRelations: [],
      },
      company,
      branches,
      users,
      subscriptions,
      payments,
      webhookEvents,
      vehicles,
      vehicleProfilePhotos,
      vehicleChangeLogs,
      drivers,
      maintenanceRecords,
      maintenancePlans,
      debts,
      fuelRecords,
      trips,
      vehicleDocuments,
      tires,
      tireReadings,
      xmlImportBatches,
      xmlInvoices,
      xmlInvoiceItems,
      retailProductImports,
      retailProductImportItems,
      references: {
        branchIds,
        vehicleIds,
        tireIds,
        subscriptionIds,
        batchIds,
        invoiceIds,
        retailImportIds,
      },
    };

    const backupDir = join(process.cwd(), 'storage', 'backups', 'companies');
    const fileName = this.buildFileName(company.slug, company.id, generatedAt);
    const backupPath = join(backupDir, fileName);
    const serializedPayload = JSON.stringify(payload, this.jsonReplacer, 2);

    return this.persistBackupToLocalDisk(backupDir, backupPath, fileName, serializedPayload, generatedAt);
  }

  private buildFileName(
    companySlug: string | null | undefined,
    companyId: string,
    generatedAt: string,
  ) {
    const safeIdentifier = String(companySlug || companyId)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || companyId;
    const timestamp = generatedAt.replace(/[:.]/g, '-');
    return `company-${safeIdentifier}-${timestamp}-${randomUUID()}.json`;
  }

  // Mantido isolado para futura troca por S3/Cloud Storage.
  private async persistBackupToLocalDisk(
    backupDir: string,
    backupPath: string,
    fileName: string,
    serializedPayload: string,
    generatedAt: string,
  ): Promise<CompanyDeletionBackupResult> {
    try {
      await mkdir(backupDir, { recursive: true });
      await writeFile(backupPath, serializedPayload, 'utf-8');
    } catch (error) {
      throw new Error(
        `Não foi possível salvar o backup da empresa: ${this.getErrorMessage(error)}`,
      );
    }

    return {
      fileName,
      filePath: backupPath,
      generatedAt,
    };
  }

  private jsonReplacer(_key: string, value: unknown) {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (
      value &&
      typeof value === 'object' &&
      'constructor' in value &&
      (value as { constructor?: { name?: string } }).constructor?.name ===
        'Decimal'
    ) {
      return String(value);
    }

    if (value instanceof Uint8Array) {
      return Buffer.from(value).toString('base64');
    }

    return value;
  }

  private getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'erro desconhecido';
  }
}
