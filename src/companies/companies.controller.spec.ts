import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

describe('CompaniesController', () => {
  let controller: CompaniesController;

  const companiesServiceMock = {
    deleteWithBackup: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [
        {
          provide: CompaniesService,
          useValue: companiesServiceMock,
        },
      ],
    }).compile();

    controller = module.get<CompaniesController>(CompaniesController);
  });

  it('encaminha a exclusao definitiva para o service', async () => {
    companiesServiceMock.deleteWithBackup.mockResolvedValue({
      success: true,
      message: 'Empresa excluída com sucesso.',
      data: {
        company: { id: 'company-1', name: 'EvFleet' },
        backup: {
          fileName: 'company-evfleet.json',
          filePath: 'storage/backups/companies/company-evfleet.json',
          generatedAt: '2026-04-01T10:00:00.000Z',
        },
        deleted: {},
      },
    });

    const body = {
      password: 'senha-correta',
      confirmationText: 'EXCLUIR EMPRESA',
    };
    const req = { user: { userId: 'admin-1', role: 'ADMIN' } };

    const result = await controller.deleteWithBackup('company-1', body, req);

    expect(companiesServiceMock.deleteWithBackup).toHaveBeenCalledWith(
      'company-1',
      body,
      req.user,
    );
    expect(result).toMatchObject({
      success: true,
      message: 'Empresa excluída com sucesso.',
    });
  });
});
