import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDocumentDto } from './dto/create-vehicle-document.dto';
import { UpdateVehicleDocumentDto } from './dto/update-vehicle-document.dto';

@Injectable()
export class VehicleDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly includeVehicle = {
    vehicle: {
      include: {
        branch: true,
      },
    },
  } as const;

  async create(dto: CreateVehicleDocumentDto) {
    await this.ensureVehicleExists(dto.vehicleId);

    return (this.prisma as any).vehicleDocument.create({
      data: {
        type: dto.type,
        name: dto.name,
        ...(dto.number !== undefined ? { number: dto.number } : {}),
        ...(dto.issueDate !== undefined ? { issueDate: new Date(dto.issueDate) } : {}),
        ...(dto.expiryDate !== undefined ? { expiryDate: new Date(dto.expiryDate) } : {}),
        status: dto.status ?? 'VALID',
        ...(dto.issuer !== undefined ? { issuer: dto.issuer } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.fileUrl !== undefined ? { fileUrl: dto.fileUrl } : {}),
        vehicleId: dto.vehicleId,
      },
      include: this.includeVehicle,
    });
  }

  async findAll() {
    return (this.prisma as any).vehicleDocument.findMany({
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
      include: this.includeVehicle,
    });
  }

  async findOne(id: string) {
    const item = await (this.prisma as any).vehicleDocument.findUnique({
      where: { id },
      include: this.includeVehicle,
    });
    if (!item) throw new NotFoundException('Documento nao encontrado');
    return item;
  }

  async update(id: string, dto: UpdateVehicleDocumentDto) {
    await this.findOne(id);
    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Envie ao menos um campo para atualizar.');
    }

    if (dto.vehicleId) await this.ensureVehicleExists(dto.vehicleId);

    return (this.prisma as any).vehicleDocument.update({
      where: { id },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.number !== undefined ? { number: dto.number } : {}),
        ...(dto.issueDate !== undefined ? { issueDate: new Date(dto.issueDate) } : {}),
        ...(dto.expiryDate !== undefined ? { expiryDate: new Date(dto.expiryDate) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.issuer !== undefined ? { issuer: dto.issuer } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.fileUrl !== undefined ? { fileUrl: dto.fileUrl } : {}),
        ...(dto.vehicleId !== undefined ? { vehicleId: dto.vehicleId } : {}),
      },
      include: this.includeVehicle,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await (this.prisma as any).vehicleDocument.delete({ where: { id } });
    return { message: 'Documento removido com sucesso' };
  }

  private async ensureVehicleExists(vehicleId: string) {
    const exists = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Veiculo nao encontrado');
  }
}
