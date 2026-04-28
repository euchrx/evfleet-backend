import {
  Injectable,
  OnApplicationShutdown,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { RequestScope } from '../common/request-scope';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  constructor() {
    super();

    this.$use(async (params, next) => {
      const companyId = RequestScope.getCompanyId();

      if (!companyId) {
        return next(params);
      }

      const readActions = new Set([
        'findMany',
        'findFirst',
        'findUnique',
        'count',
        'aggregate',
      ]);

      if (!readActions.has(params.action)) {
        return next(params);
      }

      const scopedWhere = this.resolveScopedWhere(params.model, companyId);

      if (!scopedWhere) {
        return next(params);
      }

      const currentArgs = params.args || {};
      const currentWhere = currentArgs.where || {};

      params.args = {
        ...currentArgs,
        where: {
          AND: [currentWhere, scopedWhere],
        },
      };

      if (params.action === 'findUnique') {
        params.action = 'findFirst';
      }

      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async onApplicationShutdown() {
    await this.$disconnect();
  }

  private resolveScopedWhere(model: string | undefined, companyId: string) {
    switch (model) {
      case 'Company':
        return { id: companyId };

      case 'CompanyFiscalSettings':
        return { companyId };

      case 'Branch':
      case 'User':
      case 'Subscription':
      case 'Payment':
      case 'SupportRequest':
      case 'WebhookEvent':
      case 'Vehicle':
      case 'VehicleDocument':
      case 'DangerousProduct':
      case 'XmlImportBatch':
      case 'XmlInvoice':
      case 'RetailProductImport':
      case 'TireMovement':
      case 'Mdfe':
      case 'TripFiscalDocument':
        return { companyId };

      case 'Driver':
        return { companyId };

      case 'Trip':
        return {
          OR: [
            { companyId },
            { vehicle: { companyId } },
          ],
        };

      case 'TripProduct':
        return {
          trip: {
            OR: [
              { companyId },
              { vehicle: { companyId } },
            ],
          },
        };

      case 'TripComplianceCheck':
      case 'TripGeneratedDocument':
        return {
          trip: {
            OR: [
              { companyId },
              { vehicle: { companyId } },
            ],
          },
        };

      case 'TripComplianceResult':
        return {
          check: {
            trip: {
              OR: [
                { companyId },
                { vehicle: { companyId } },
              ],
            },
          },
        };

      case 'VehicleImplementLink':
        return {
          vehicle: {
            companyId,
          },
        };

      case 'VehicleImplementHistory':
        return {
          vehicle: {
            companyId,
          },
        };

      case 'MaintenanceRecord':
      case 'MaintenancePlan':
      case 'Debt':
      case 'FuelRecord':
      case 'VehicleChangeLog':
      case 'VehicleProfilePhoto':
        return {
          vehicle: {
            companyId,
          },
        };

      case 'Tire':
        return {
          OR: [
            { vehicle: { companyId } },
            { vehicleId: null },
          ],
        };

      case 'TireReading':
        return {
          OR: [
            { vehicle: { companyId } },
            { tire: { vehicle: { companyId } } },
            { tire: { vehicleId: null } },
          ],
        };

      case 'Plan':
        return {
          OR: [
            { companyId },
            { companyId: null },
            { isPublic: true },
          ],
        };

      default:
        return null;
    }
  }
}

export { Prisma };