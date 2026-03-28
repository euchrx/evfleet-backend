import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesService } from './companies.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CompaniesService', () => {
  let service: CompaniesService;

  const prismaMock = {
    company: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  it('cria empresa com sucesso', async () => {
    const now = new Date('2026-03-27T00:00:00.000Z');
    prismaMock.company.findUnique.mockResolvedValue(null);
    prismaMock.company.create.mockResolvedValue({
      id: 'company-1',
      name: 'EvTech',
      slug: 'evtech',
      active: true,
      createdAt: now,
    });

    const result = await service.create({
      name: 'EvTech',
      slug: 'evtech',
    });

    expect(result).toEqual({
      id: 'company-1',
      name: 'EvTech',
      slug: 'evtech',
      active: true,
      createdAt: now,
    });
    expect(prismaMock.company.findUnique).toHaveBeenCalledWith({
      where: { slug: 'evtech' },
      select: { id: true },
    });
    expect(prismaMock.company.create).toHaveBeenCalled();
  });

  it('lança erro para slug duplicado', async () => {
    prismaMock.company.findUnique.mockResolvedValue({ id: 'already-exists' });

    await expect(
      service.create({
        name: 'EvTech',
        slug: 'evtech',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.create({
        name: 'EvTech',
        slug: 'evtech',
      }),
    ).rejects.toThrow('Slug já está em uso.');
  });
});
