import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyDeletionService } from './company-deletion.service';
import { CompaniesService } from './companies.service';

describe('CompaniesService', () => {
  let service: CompaniesService;

  const prismaMock = {
    company: {
      findUnique: jest.fn(),
    },
  };

  const authServiceMock = {
    reauthenticateAdmin: jest.fn(),
  };

  const companyDeletionServiceMock = {
    deleteWithBackup: jest.fn(),
    findCompletedDeletionResult: jest.fn(),
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
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
        {
          provide: CompanyDeletionService,
          useValue: companyDeletionServiceMock,
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  it('falha com senha incorreta', async () => {
    prismaMock.company.findUnique.mockResolvedValue({
      id: 'company-1',
      name: 'EvFleet',
      slug: 'evfleet',
    });
    authServiceMock.reauthenticateAdmin.mockRejectedValue(
      new UnauthorizedException('Senha do administrador incorreta.'),
    );

    await expect(
      service.validateDeleteAuthorization(
        'company-1',
        {
          password: 'senha-incorreta',
          confirmationText: 'EXCLUIR EMPRESA',
        },
        { userId: 'admin-1' },
      ),
    ).rejects.toMatchObject({
      response: {
        success: false,
        errorCode: 'COMPANY_DELETE_INVALID_PASSWORD',
      },
    });

    expect(authServiceMock.reauthenticateAdmin).toHaveBeenCalledWith(
      'admin-1',
      'senha-incorreta',
    );
  });

  it('falha com confirmationText invalido', async () => {
    prismaMock.company.findUnique.mockResolvedValue({
      id: 'company-1',
      name: 'EvFleet',
      slug: 'evfleet',
    });

    await expect(
      service.validateDeleteAuthorization(
        'company-1',
        {
          password: 'senha-correta',
          confirmationText: 'EXCLUIR',
        },
        { userId: 'admin-1' },
      ),
    ).rejects.toMatchObject({
      response: {
        success: false,
        errorCode: 'COMPANY_DELETE_CONFIRMATION_TEXT_INVALID',
      },
    });

    expect(authServiceMock.reauthenticateAdmin).not.toHaveBeenCalled();
  });

  it('falha se a empresa nao existir', async () => {
    prismaMock.company.findUnique.mockResolvedValue(null);

    await expect(
      service.validateDeleteAuthorization(
        'company-inexistente',
        {
          password: 'senha-correta',
          confirmationText: 'EXCLUIR EMPRESA',
        },
        { userId: 'admin-1' },
      ),
    ).rejects.toMatchObject({
      response: {
        success: false,
        errorCode: 'COMPANY_NOT_FOUND',
      },
    });

    expect(authServiceMock.reauthenticateAdmin).not.toHaveBeenCalled();
  });

  it('encaminha a exclusao para o service especifico apos validar a reautenticacao', async () => {
    prismaMock.company.findUnique.mockResolvedValue({
      id: 'company-1',
      name: 'EvFleet',
      slug: 'evfleet',
    });
    authServiceMock.reauthenticateAdmin.mockResolvedValue({
      id: 'admin-1',
      role: 'ADMIN',
    });
    companyDeletionServiceMock.deleteWithBackup.mockResolvedValue({
      success: true,
      message: 'Empresa excluída com sucesso.',
      data: {
        company: {
          id: 'company-1',
          name: 'EvFleet',
        },
        backup: {
          identifier: 'company-evfleet.json',
          fileName: 'company-evfleet.json',
          filePath: 'storage/backups/companies/company-evfleet.json',
          generatedAt: '2026-04-01T12:00:00.000Z',
          metadataDownloadAvailable: false,
        },
        deleted: {
          company: 1,
          branches: 1,
          users: 1,
          subscriptions: 1,
          payments: 0,
          webhookEvents: 0,
          vehicles: 0,
          vehicleProfilePhotos: 0,
          vehicleChangeLogs: 0,
          drivers: 0,
          maintenanceRecords: 0,
          maintenancePlans: 0,
          debts: 0,
          fuelRecords: 0,
          trips: 0,
          vehicleDocuments: 0,
          tires: 0,
          tireReadings: 0,
          xmlImportBatches: 0,
          xmlInvoices: 0,
          xmlInvoiceItems: 0,
          retailProductImports: 0,
          retailProductImportItems: 0,
        },
      },
    });

    const result = await service.deleteWithBackup(
      'company-1',
      {
        password: 'senha-correta',
        confirmationText: 'EXCLUIR EMPRESA',
      },
      { userId: 'admin-1' },
    );

    expect(companyDeletionServiceMock.deleteWithBackup).toHaveBeenCalledWith(
      {
        id: 'company-1',
        name: 'EvFleet',
        slug: 'evfleet',
      },
      { userId: 'admin-1' },
    );
    expect(result).toMatchObject({
      success: true,
      message: 'Empresa excluída com sucesso.',
    });
  });

  it('retorna resultado anterior quando a exclusao ja foi concluida antes', async () => {
    prismaMock.company.findUnique.mockResolvedValue(null);
    companyDeletionServiceMock.findCompletedDeletionResult.mockResolvedValue({
      success: true,
      message: 'A empresa já havia sido excluída anteriormente.',
      data: {
        company: {
          id: 'company-1',
          name: 'EvFleet',
        },
        backup: {
          identifier: 'company-evfleet.json',
          fileName: 'company-evfleet.json',
          filePath: 'storage/backups/companies/company-evfleet.json',
          generatedAt: '2026-04-01T12:00:00.000Z',
          metadataDownloadAvailable: false,
        },
        deleted: {
          company: 1,
          branches: 1,
          users: 3,
          subscriptions: 3,
          payments: 0,
          webhookEvents: 0,
          vehicles: 0,
          vehicleProfilePhotos: 0,
          vehicleChangeLogs: 0,
          drivers: 0,
          maintenanceRecords: 0,
          maintenancePlans: 0,
          debts: 0,
          fuelRecords: 0,
          trips: 0,
          vehicleDocuments: 0,
          tires: 0,
          tireReadings: 0,
          xmlImportBatches: 0,
          xmlInvoices: 0,
          xmlInvoiceItems: 0,
          retailProductImports: 0,
          retailProductImportItems: 0,
        },
      },
    });

    const result = await service.deleteWithBackup(
      'company-1',
      {
        password: 'senha-correta',
        confirmationText: 'EXCLUIR EMPRESA',
      },
      { userId: 'admin-1' },
    );

    expect(companyDeletionServiceMock.findCompletedDeletionResult).toHaveBeenCalledWith(
      'company-1',
    );
    expect(result).toMatchObject({
      success: true,
      message: 'A empresa já havia sido excluída anteriormente.',
    });
  });
});
