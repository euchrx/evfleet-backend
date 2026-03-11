import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CostCentersService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string }) {
    return this.prisma.costCenter.create({
      data,
    });
  }

  async findAll() {
    return this.prisma.costCenter.findMany();
  }
}