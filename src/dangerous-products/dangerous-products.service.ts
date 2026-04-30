import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDangerousProductDto } from "./dto/create-dangerous-product.dto";
import { UpdateDangerousProductDto } from "./dto/update-dangerous-product.dto";

@Injectable()
export class DangerousProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.dangerousProduct.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findActive(companyId: string) {
    return this.prisma.dangerousProduct.findMany({
      where: {
        companyId,
        active: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async findOne(id: string, companyId: string) {
    const product = await this.prisma.dangerousProduct.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!product) {
      throw new NotFoundException("Produto não encontrado");
    }

    return product;
  }

  async create(companyId: string, dto: CreateDangerousProductDto) {
    return this.prisma.dangerousProduct.create({
      data: {
        ...dto,
        companyId, // 🔥 ESSENCIAL
      },
    });
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateDangerousProductDto,
  ) {
    const existing = await this.prisma.dangerousProduct.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!existing) {
      throw new NotFoundException("Produto não encontrado");
    }

    return this.prisma.dangerousProduct.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, companyId: string) {
    const existing = await this.prisma.dangerousProduct.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!existing) {
      throw new NotFoundException("Produto não encontrado");
    }

    await this.prisma.dangerousProduct.delete({
      where: { id },
    });
  }
}