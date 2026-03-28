import {
  Injectable,
  OnApplicationShutdown,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RequestScope } from '../common/request-scope';

@Injectable()
export class PrismaService extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown {
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
      const nextAction = params.action === 'findUnique' ? 'findFirst' : params.action;
      params.args = {
        ...currentArgs,
        where: {
          AND: [currentWhere, scopedWhere],
        },
      };
      params.action = nextAction;

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
      case 'Branch':
      case 'User':
      case 'Subscription':
      case 'Payment':
      case 'WebhookEvent':
        return { companyId };
      case 'Vehicle':
        return { branch: { companyId } };
      case 'Driver':
        return { vehicle: { branch: { companyId } } };
      case 'MaintenanceRecord':
      case 'MaintenancePlan':
      case 'Debt':
      case 'FuelRecord':
      case 'Trip':
      case 'VehicleDocument':
      case 'VehicleChangeLog':
      case 'VehicleProfilePhoto':
        return { vehicle: { branch: { companyId } } };
      case 'Tire':
        return { vehicle: { branch: { companyId } } };
      case 'TireReading':
        return {
          OR: [
            { vehicle: { branch: { companyId } } },
            { tire: { vehicle: { branch: { companyId } } } },
          ],
        };
      default:
        return null;
    }
  }
}
