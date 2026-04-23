import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTireMovementDto } from './dto/create-tire-movement.dto';

@Injectable()
export class TireMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreateTireMovementDto) {
    return this.prisma.tireMovement.create({
      data: {
        companyId,
        vehicleId: dto.vehicleId || null,
        tireId: dto.tireId || null,
        secondTireId: dto.secondTireId || null,
        type: dto.type,
        tireSerial: dto.tireSerial,
        secondTireSerial: dto.secondTireSerial || null,
        fromAxle: dto.fromAxle || null,
        fromWheel: dto.fromWheel || null,
        toAxle: dto.toAxle || null,
        toWheel: dto.toWheel || null,
        note: dto.note || null,
      },
      include: {
        vehicle: true,
        tire: true,
        secondTire: true,
      },
    });
  }

  findAll(companyId: string, vehicleId?: string, tireId?: string) {
    return this.prisma.tireMovement.findMany({
      where: {
        companyId,
        ...(vehicleId ? { vehicleId } : {}),
        ...(tireId ? { OR: [{ tireId }, { secondTireId: tireId }] } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });
  }
}