import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';

@Injectable()
export class DebtsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly includeVehicle = {
    vehicle: {
      include: {
        branch: true,
      },
    },
  } as const;

  async create(dto: CreateDebtDto) {
    const prisma = this.prisma as any;
    await this.ensureVehicleExists(dto.vehicleId);

    const created = await prisma.debt.create({
      data: {
        description: dto.description,
        amount: dto.amount,
        category: dto.category ?? 'FINE',
        points: Math.round(dto.points ?? 0),
        debtDate: new Date(dto.debtDate),
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
        ...(dto.referenceMonth !== undefined ? { referenceMonth: dto.referenceMonth } : {}),
        ...(dto.creditor !== undefined ? { creditor: dto.creditor } : {}),
        ...(dto.isRecurring !== undefined ? { isRecurring: dto.isRecurring } : {}),
        status: dto.status,
        vehicleId: dto.vehicleId,
      },
      include: this.includeVehicle,
    });
    return created;
  }

  async findAll() {
    const prisma = this.prisma as any;
    const items = await prisma.debt.findMany({
      orderBy: { debtDate: 'desc' },
      include: this.includeVehicle,
    });
    return items;
  }

  async findOne(id: string) {
    const prisma = this.prisma as any;
    const debt = await prisma.debt.findUnique({
      where: { id },
      include: this.includeVehicle,
    });

    if (!debt) throw new NotFoundException('Debito nao encontrado');
    return debt;
  }

  async update(id: string, dto: UpdateDebtDto) {
    const prisma = this.prisma as any;
    await this.findOne(id);

    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Envie ao menos um campo para atualizar.');
    }

    if (dto.vehicleId) {
      await this.ensureVehicleExists(dto.vehicleId);
    }

    const updated = await prisma.debt.update({
      where: { id },
      data: {
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.points !== undefined ? { points: Math.round(dto.points) } : {}),
        ...(dto.debtDate !== undefined ? { debtDate: new Date(dto.debtDate) } : {}),
        ...(dto.dueDate !== undefined
          ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
          : {}),
        ...(dto.referenceMonth !== undefined ? { referenceMonth: dto.referenceMonth } : {}),
        ...(dto.creditor !== undefined ? { creditor: dto.creditor } : {}),
        ...(dto.isRecurring !== undefined ? { isRecurring: dto.isRecurring } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.vehicleId !== undefined ? { vehicleId: dto.vehicleId } : {}),
      },
      include: this.includeVehicle,
    });
    return updated;
  }

  async remove(id: string) {
    const prisma = this.prisma as any;
    await this.findOne(id);
    await prisma.debt.delete({ where: { id } });
    return { message: 'Debito removido com sucesso' };
  }

  private async ensureVehicleExists(vehicleId: string) {
    const exists = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });

    if (!exists) throw new NotFoundException('Veiculo nao encontrado');
  }
}
