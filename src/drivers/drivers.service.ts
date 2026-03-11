import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly includeVehicle = {
    vehicle: {
      include: {
        branch: true,
        costCenter: true,
      },
    },
  } as const;

  async create(dto: CreateDriverDto) {
    const prisma = this.prisma as any;

    if (dto.vehicleId) {
      await this.ensureVehicleExists(dto.vehicleId);
    }

    return prisma.driver.create({
      data: {
        name: dto.name,
        cpf: dto.cpf,
        cnh: dto.cnh,
        cnhCategory: dto.cnhCategory,
        cnhExpiresAt: new Date(dto.cnhExpiresAt),
        phone: dto.phone ?? null,
        status: dto.status,
        vehicleId: dto.vehicleId ?? null,
      },
      include: this.includeVehicle,
    });
  }

  async findAll() {
    const prisma = this.prisma as any;
    return prisma.driver.findMany({
      orderBy: { createdAt: 'desc' },
      include: this.includeVehicle,
    });
  }

  async findOne(id: string) {
    const prisma = this.prisma as any;
    const driver = await prisma.driver.findUnique({
      where: { id },
      include: this.includeVehicle,
    });

    if (!driver) throw new NotFoundException('Motorista nao encontrado');
    return driver;
  }

  async update(id: string, dto: UpdateDriverDto) {
    const prisma = this.prisma as any;

    await this.findOne(id);

    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Envie ao menos um campo para atualizar.');
    }

    if (dto.vehicleId) {
      await this.ensureVehicleExists(dto.vehicleId);
    }

    return prisma.driver.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.cpf !== undefined ? { cpf: dto.cpf } : {}),
        ...(dto.cnh !== undefined ? { cnh: dto.cnh } : {}),
        ...(dto.cnhCategory !== undefined ? { cnhCategory: dto.cnhCategory } : {}),
        ...(dto.cnhExpiresAt !== undefined
          ? { cnhExpiresAt: new Date(dto.cnhExpiresAt) }
          : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.vehicleId !== undefined ? { vehicleId: dto.vehicleId } : {}),
      },
      include: this.includeVehicle,
    });
  }

  async remove(id: string) {
    const prisma = this.prisma as any;
    await this.findOne(id);
    await prisma.driver.delete({ where: { id } });
    return { message: 'Motorista removido com sucesso' };
  }

  private async ensureVehicleExists(vehicleId: string) {
    const exists = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });

    if (!exists) throw new NotFoundException('Veiculo nao encontrado');
  }
}
