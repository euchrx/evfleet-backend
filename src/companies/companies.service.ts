import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCompanyDto) {
    const normalizedName = dto.name?.trim();
    const normalizedSlug = dto.slug?.trim();
    const normalizedDocument = dto.document?.trim();

    if (!normalizedName) {
      throw new BadRequestException('Nome da empresa é obrigatório.');
    }

    if (normalizedSlug) {
      const existingSlug = await this.prisma.company.findUnique({
        where: { slug: normalizedSlug },
        select: { id: true },
      });
      if (existingSlug) {
        throw new BadRequestException('Slug já está em uso.');
      }
    }

    try {
      return await this.prisma.company.create({
        data: {
          name: normalizedName,
          document: normalizedDocument || null,
          slug: normalizedSlug || null,
          active: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          active: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Slug já está em uso.');
      }
      throw error;
    }
  }
}
