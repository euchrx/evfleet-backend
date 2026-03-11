import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaintenancePlanDto } from './dto/create-maintenance-plan.dto';
import { UpdateMaintenancePlanDto } from './dto/update-maintenance-plan.dto';

@Injectable()
export class MaintenancePlansService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly includeVehicle = {
    vehicle: {
      include: {
        branch: true,
      },
    },
  } as const;

  async create(dto: CreateMaintenancePlanDto) {
    await this.ensureVehicleExists(dto.vehicleId);

    return this.prisma.maintenancePlan.create({
      data: {
        name: dto.name,
        planType: dto.planType,
        intervalUnit: dto.intervalUnit,
        intervalValue: dto.intervalValue,
        alertBeforeKm: dto.alertBeforeKm ?? 500,
        alertBeforeDays: dto.alertBeforeDays ?? 7,
        nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : null,
        nextDueKm: dto.nextDueKm ?? null,
        lastExecutedDate: dto.lastExecutedDate
          ? new Date(dto.lastExecutedDate)
          : null,
        active: dto.active ?? true,
        notes: dto.notes ?? null,
        vehicleId: dto.vehicleId,
      },
      include: this.includeVehicle,
    });
  }

  async findAll() {
    return this.prisma.maintenancePlan.findMany({
      orderBy: [{ active: 'desc' }, { nextDueDate: 'asc' }],
      include: this.includeVehicle,
    });
  }

  async getAgenda() {
    return this.prisma.maintenancePlan.findMany({
      where: { active: true },
      orderBy: [{ nextDueDate: 'asc' }, { nextDueKm: 'asc' }],
      include: this.includeVehicle,
    });
  }

  async getAlerts() {
    const plans = await this.prisma.maintenancePlan.findMany({
      where: { active: true },
      include: {
        vehicle: {
          include: {
            branch: true,
          },
        },
      },
      orderBy: [{ nextDueDate: 'asc' }, { nextDueKm: 'asc' }],
    });

    const today = new Date();
    const alerts: any[] = [];

    for (const plan of plans) {
      if (plan.nextDueDate) {
        const diffDays = Math.ceil(
          (plan.nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        const alertDays = plan.alertBeforeDays ?? 7;

        if (diffDays <= alertDays) {
          alerts.push({
            planId: plan.id,
            vehicleId: plan.vehicleId,
            vehicle: plan.vehicle ? `${plan.vehicle.plate} - ${plan.vehicle.model}` : plan.vehicleId,
            type: 'TIME',
            status: diffDays < 0 ? 'OVERDUE' : 'DUE_SOON',
            message:
              diffDays < 0
                ? `Manutencao vencida ha ${Math.abs(diffDays)} dia(s).`
                : `Manutencao vence em ${diffDays} dia(s).`,
            dueDate: plan.nextDueDate,
          });
        }
      }

      if (plan.nextDueKm !== null && plan.nextDueKm !== undefined) {
        const currentKm = plan.vehicle?.currentKm ?? 0;
        const remainingKm = plan.nextDueKm - currentKm;
        const alertKm = plan.alertBeforeKm ?? 500;

        if (remainingKm <= alertKm) {
          alerts.push({
            planId: plan.id,
            vehicleId: plan.vehicleId,
            vehicle: plan.vehicle ? `${plan.vehicle.plate} - ${plan.vehicle.model}` : plan.vehicleId,
            type: 'KM',
            status: remainingKm < 0 ? 'OVERDUE' : 'DUE_SOON',
            message:
              remainingKm < 0
                ? `Manutencao vencida por KM (${Math.abs(remainingKm)} km acima).`
                : `Manutencao a ${remainingKm} km de distancia.`,
            dueKm: plan.nextDueKm,
            currentKm,
          });
        }
      }
    }

    return {
      total: alerts.length,
      alerts,
    };
  }

  async findOne(id: string) {
    const plan = await this.prisma.maintenancePlan.findUnique({
      where: { id },
      include: this.includeVehicle,
    });

    if (!plan) throw new NotFoundException('Plano de manutencao nao encontrado');
    return plan;
  }

  async update(id: string, dto: UpdateMaintenancePlanDto) {
    await this.findOne(id);

    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Envie ao menos um campo para atualizar.');
    }

    if (dto.vehicleId) {
      await this.ensureVehicleExists(dto.vehicleId);
    }

    return this.prisma.maintenancePlan.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.planType !== undefined ? { planType: dto.planType } : {}),
        ...(dto.intervalUnit !== undefined ? { intervalUnit: dto.intervalUnit } : {}),
        ...(dto.intervalValue !== undefined ? { intervalValue: dto.intervalValue } : {}),
        ...(dto.alertBeforeKm !== undefined ? { alertBeforeKm: dto.alertBeforeKm } : {}),
        ...(dto.alertBeforeDays !== undefined
          ? { alertBeforeDays: dto.alertBeforeDays }
          : {}),
        ...(dto.nextDueDate !== undefined
          ? { nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : null }
          : {}),
        ...(dto.nextDueKm !== undefined ? { nextDueKm: dto.nextDueKm } : {}),
        ...(dto.lastExecutedDate !== undefined
          ? {
              lastExecutedDate: dto.lastExecutedDate
                ? new Date(dto.lastExecutedDate)
                : null,
            }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.vehicleId !== undefined ? { vehicleId: dto.vehicleId } : {}),
      },
      include: this.includeVehicle,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.maintenancePlan.delete({ where: { id } });
    return { message: 'Plano de manutencao removido com sucesso' };
  }

  private async ensureVehicleExists(vehicleId: string) {
    const exists = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });

    if (!exists) throw new NotFoundException('Veiculo nao encontrado');
  }
}
