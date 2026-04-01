import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { Prisma, PrismaService } from '../prisma/prisma.service';
import { CompanyBackupService } from './services/company-backup.service';
import {
  CompanyDeletionBackupResult,
  CompanyDeletionErrorBody,
  CompanyDeletionSummary,
  DeleteWithBackupResponse,
} from './company-deletion.types';

@Injectable()
export class CompanyDeletionService {
  private static readonly AUDIT_ACTION = 'DELETE_COMPANY_WITH_BACKUP';
  private readonly logger = new Logger(CompanyDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyBackupService: CompanyBackupService,
    private readonly auditService: AuditService,
  ) {}

  async deleteWithBackup(
    company: { id: string; name: string; slug?: string | null },
    authenticatedUser: any,
  ): Promise<DeleteWithBackupResponse> {
    const actorUserId = String(
      authenticatedUser?.userId || authenticatedUser?.id || '',
    ).trim();

    if (!actorUserId) {
      throw this.buildUnauthorizedException(
        'COMPANY_DELETE_AUTHENTICATED_USER_INVALID',
        'Não foi possível validar o usuário autenticado para esta ação.',
      );
    }

    let backup: CompanyDeletionBackupResult;

    try {
      backup = await this.companyBackupService.createBackup(
        company.id,
        actorUserId,
      );
    } catch (error) {
      await this.auditService.createEntry({
        action: CompanyDeletionService.AUDIT_ACTION,
        entity: 'Company',
        entityId: company.id,
        performedByUserId: actorUserId,
        metadata: {
          companyName: company.name,
          companySlug: company.slug || null,
          backupFileName: null,
          backupFilePath: null,
          deletedSummary: null,
          executedAt: new Date().toISOString(),
          outcome: 'BACKUP_FAILED',
          errorMessage: this.getErrorMessage(error),
        },
        swallowErrors: true,
      });

      throw this.buildInternalServerErrorException(
        'COMPANY_BACKUP_FAILED',
        `Não foi possível gerar o backup da empresa antes da exclusão. ${this.getErrorMessage(error)}`,
      );
    }

    try {
      const deleted = await this.prisma.$transaction(async (tx) => {
        const deletedSummary = await this.performDeletion(tx, company.id);

        await this.auditService.createEntry({
          action: CompanyDeletionService.AUDIT_ACTION,
          entity: 'Company',
          entityId: company.id,
          performedByUserId: actorUserId,
          metadata: {
            companyName: company.name,
            companySlug: company.slug || null,
            backupFileName: backup.fileName,
            backupFilePath: backup.filePath,
            deletedSummary,
            executedAt: new Date().toISOString(),
            outcome: 'SUCCESS',
          },
          client: tx,
        });

        return deletedSummary;
      });

      return {
        success: true,
        message: 'Empresa excluída com sucesso.',
        data: {
          company: {
            id: company.id,
            name: company.name,
          },
          backup,
          deleted,
        },
      };
    } catch (error) {
      await this.auditService.createEntry({
        action: CompanyDeletionService.AUDIT_ACTION,
        entity: 'Company',
        entityId: company.id,
        performedByUserId: actorUserId,
        metadata: {
          companyName: company.name,
          companySlug: company.slug || null,
          backupFileName: backup.fileName,
          backupFilePath: backup.filePath,
          deletedSummary: null,
          executedAt: new Date().toISOString(),
          outcome: 'FAILED',
          errorMessage: this.getErrorMessage(error),
        },
        swallowErrors: true,
      });

      this.logger.error(
        `Falha ao excluir empresa ${company.id}: ${this.getErrorMessage(error)}`,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      if (this.isRelationalIntegrityError(error)) {
        throw this.buildConflictException(
          'COMPANY_DELETE_RELATIONAL_INTEGRITY_FAILED',
          'Não foi possível excluir a empresa porque ainda existem vínculos relacionais ativos em dados dependentes.',
        );
      }

      throw this.buildInternalServerErrorException(
        'COMPANY_DELETE_FAILED',
        `A exclusão definitiva da empresa falhou após a geração do backup. ${this.getErrorMessage(error)}`,
      );
    }
  }

  private async performDeletion(
    tx: Prisma.TransactionClient,
    companyId: string,
  ): Promise<CompanyDeletionSummary> {
    const branches = await tx.branch.findMany({
      where: { companyId },
      select: { id: true },
    });
    const branchIds = branches.map((item) => item.id);

    const vehicles = branchIds.length
      ? await tx.vehicle.findMany({
          where: { branchId: { in: branchIds } },
          select: { id: true },
        })
      : [];
    const vehicleIds = vehicles.map((item) => item.id);

    const drivers = vehicleIds.length
      ? await tx.driver.findMany({
          where: { vehicleId: { in: vehicleIds } },
          select: { id: true },
        })
      : [];
    const driverIds = drivers.map((item) => item.id);

    const tires = vehicleIds.length
      ? await tx.tire.findMany({
          where: { vehicleId: { in: vehicleIds } },
          select: { id: true },
        })
      : [];
    const tireIds = tires.map((item) => item.id);

    const subscriptions = await tx.subscription.findMany({
      where: { companyId },
      select: { id: true },
    });
    const subscriptionIds = subscriptions.map((item) => item.id);

    const xmlInvoices = await tx.xmlInvoice.findMany({
      where: { companyId },
      select: { id: true },
    });
    const invoiceIds = xmlInvoices.map((item) => item.id);

    const retailImports = await tx.retailProductImport.findMany({
      where: { companyId },
      select: { id: true },
    });
    const retailImportIds = retailImports.map((item) => item.id);

    const summary: CompanyDeletionSummary = {
      company: 0,
      branches: 0,
      users: 0,
      subscriptions: 0,
      payments: 0,
      webhookEvents: 0,
      vehicles: 0,
      vehicleProfilePhotos: 0,
      vehicleChangeLogs: 0,
      drivers: 0,
      maintenanceRecords: 0,
      maintenancePlans: 0,
      debts: 0,
      fuelRecords: 0,
      trips: 0,
      vehicleDocuments: 0,
      tires: 0,
      tireReadings: 0,
      xmlImportBatches: 0,
      xmlInvoices: 0,
      xmlInvoiceItems: 0,
      retailProductImports: 0,
      retailProductImportItems: 0,
    };

    if (vehicleIds.length) {
      summary.vehicleProfilePhotos = (
        await tx.vehicleProfilePhoto.deleteMany({
          where: { vehicleId: { in: vehicleIds } },
        })
      ).count;

      summary.vehicleChangeLogs = (
        await tx.vehicleChangeLog.deleteMany({
          where: { vehicleId: { in: vehicleIds } },
        })
      ).count;

      summary.vehicleDocuments = (
        await tx.vehicleDocument.deleteMany({
          where: { vehicleId: { in: vehicleIds } },
        })
      ).count;

      summary.trips = (
        await tx.trip.deleteMany({
          where: { vehicleId: { in: vehicleIds } },
        })
      ).count;

      summary.fuelRecords = (
        await tx.fuelRecord.deleteMany({
          where: {
            OR: [
              { vehicleId: { in: vehicleIds } },
              ...(driverIds.length ? [{ driverId: { in: driverIds } }] : []),
            ],
          },
        })
      ).count;

      summary.debts = (
        await tx.debt.deleteMany({
          where: { vehicleId: { in: vehicleIds } },
        })
      ).count;

      summary.maintenancePlans = (
        await tx.maintenancePlan.deleteMany({
          where: { vehicleId: { in: vehicleIds } },
        })
      ).count;

      summary.maintenanceRecords = (
        await tx.maintenanceRecord.deleteMany({
          where: { vehicleId: { in: vehicleIds } },
        })
      ).count;

      if (tireIds.length || vehicleIds.length) {
        summary.tireReadings = (
          await tx.tireReading.deleteMany({
            where: {
              OR: [
                ...(tireIds.length ? [{ tireId: { in: tireIds } }] : []),
                ...(vehicleIds.length ? [{ vehicleId: { in: vehicleIds } }] : []),
              ],
            },
          })
        ).count;
      }

      if (driverIds.length) {
        summary.drivers = (
          await tx.driver.deleteMany({
            where: { id: { in: driverIds } },
          })
        ).count;
      }

      if (tireIds.length) {
        summary.tires = (
          await tx.tire.deleteMany({
            where: { id: { in: tireIds } },
          })
        ).count;
      }

      summary.vehicles = (
        await tx.vehicle.deleteMany({
          where: { id: { in: vehicleIds } },
        })
      ).count;
    }

    if (invoiceIds.length) {
      summary.xmlInvoiceItems = (
        await tx.xmlInvoiceItem.deleteMany({
          where: { invoiceId: { in: invoiceIds } },
        })
      ).count;
    }

    if (retailImportIds.length) {
      summary.retailProductImportItems = (
        await tx.retailProductImportItem.deleteMany({
          where: { retailProductImportId: { in: retailImportIds } },
        })
      ).count;
    }

    summary.retailProductImports = (
      await tx.retailProductImport.deleteMany({
        where: { companyId },
      })
    ).count;

    summary.xmlInvoices = (
      await tx.xmlInvoice.deleteMany({
        where: { companyId },
      })
    ).count;

    summary.xmlImportBatches = (
      await tx.xmlImportBatch.deleteMany({
        where: { companyId },
      })
    ).count;

    summary.payments = (
      await tx.payment.deleteMany({
        where: { companyId },
      })
    ).count;

    summary.webhookEvents = (
      await tx.webhookEvent.deleteMany({
        where: {
          OR: [
            { companyId },
            ...(subscriptionIds.length
              ? [{ subscriptionId: { in: subscriptionIds } }]
              : []),
          ],
        },
      })
    ).count;

    summary.subscriptions = (
      await tx.subscription.deleteMany({
        where: { companyId },
      })
    ).count;

    summary.users = (
      await tx.user.deleteMany({
        where: { companyId },
      })
    ).count;

    summary.branches = (
      await tx.branch.deleteMany({
        where: { companyId },
      })
    ).count;

    await tx.company.delete({
      where: { id: companyId },
    });
    summary.company = 1;

    return summary;
  }

  private getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (this.isErrorWithMessage(error)) {
      return error.message;
    }

    return 'Erro interno não identificado.';
  }

  private isRelationalIntegrityError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === 'P2003' || error.code === 'P2014';
    }

    if (!error || typeof error !== 'object' || !('code' in error)) {
      return false;
    }

    const code = String((error as { code?: string }).code || '').trim();
    return code === 'P2003' || code === 'P2014';
  }

  private isErrorWithMessage(error: unknown): error is { message: string } {
    return !!error && typeof error === 'object' && 'message' in error;
  }

  private buildConflictException(errorCode: string, message: string) {
    return new ConflictException(this.buildErrorBody(errorCode, message));
  }

  private buildInternalServerErrorException(
    errorCode: string,
    message: string,
  ) {
    return new InternalServerErrorException(
      this.buildErrorBody(errorCode, message),
    );
  }

  private buildUnauthorizedException(errorCode: string, message: string) {
    return new UnauthorizedException(this.buildErrorBody(errorCode, message));
  }

  private buildErrorBody(
    errorCode: string,
    message: string,
  ): CompanyDeletionErrorBody {
    return {
      success: false,
      errorCode,
      message,
    };
  }
}
