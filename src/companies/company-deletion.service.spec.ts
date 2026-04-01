import { CompanyDeletionService } from './company-deletion.service';

describe('CompanyDeletionService', () => {
  const createDeleteManyMock = (
    step: string,
    count: number,
    order: string[],
  ) =>
    jest.fn().mockImplementation(async () => {
      order.push(step);
      return { count };
    });

  const createDeleteMock = (step: string, order: string[]) =>
    jest.fn().mockImplementation(async () => {
      order.push(step);
      return { id: 'company-1' };
    });

  const createTransactionClient = (order: string[]) => ({
    $queryRaw: jest.fn().mockResolvedValue([{ locked: true }]),
    branch: {
      findMany: jest.fn().mockResolvedValue([{ id: 'branch-1' }]),
      deleteMany: createDeleteManyMock('branches', 1, order),
    },
    vehicle: {
      findMany: jest.fn().mockResolvedValue([{ id: 'vehicle-1' }]),
      deleteMany: createDeleteManyMock('vehicles', 1, order),
    },
    driver: {
      findMany: jest.fn().mockResolvedValue([{ id: 'driver-1' }]),
      deleteMany: createDeleteManyMock('drivers', 1, order),
    },
    tire: {
      findMany: jest.fn().mockResolvedValue([{ id: 'tire-1' }]),
      deleteMany: createDeleteManyMock('tires', 1, order),
    },
    subscription: {
      findMany: jest.fn().mockResolvedValue([{ id: 'subscription-1' }]),
      deleteMany: createDeleteManyMock('subscriptions', 3, order),
    },
    xmlInvoice: {
      findMany: jest.fn().mockResolvedValue([{ id: 'invoice-1' }]),
      deleteMany: createDeleteManyMock('xmlInvoices', 1, order),
    },
    retailProductImport: {
      findMany: jest.fn().mockResolvedValue([{ id: 'retail-import-1' }]),
      deleteMany: createDeleteManyMock('retailProductImports', 1, order),
    },
    vehicleProfilePhoto: {
      deleteMany: createDeleteManyMock('vehicleProfilePhotos', 1, order),
    },
    vehicleChangeLog: {
      deleteMany: createDeleteManyMock('vehicleChangeLogs', 1, order),
    },
    vehicleDocument: {
      deleteMany: createDeleteManyMock('vehicleDocuments', 1, order),
    },
    trip: {
      deleteMany: createDeleteManyMock('trips', 1, order),
    },
    fuelRecord: {
      deleteMany: createDeleteManyMock('fuelRecords', 1, order),
    },
    debt: {
      deleteMany: createDeleteManyMock('debts', 1, order),
    },
    maintenancePlan: {
      deleteMany: createDeleteManyMock('maintenancePlans', 1, order),
    },
    maintenanceRecord: {
      deleteMany: createDeleteManyMock('maintenanceRecords', 1, order),
    },
    tireReading: {
      deleteMany: createDeleteManyMock('tireReadings', 1, order),
    },
    xmlInvoiceItem: {
      deleteMany: createDeleteManyMock('xmlInvoiceItems', 1, order),
    },
    retailProductImportItem: {
      deleteMany: createDeleteManyMock('retailProductImportItems', 1, order),
    },
    xmlImportBatch: {
      deleteMany: createDeleteManyMock('xmlImportBatches', 1, order),
    },
    payment: {
      deleteMany: createDeleteManyMock('payments', 0, order),
    },
    webhookEvent: {
      deleteMany: createDeleteManyMock('webhookEvents', 1, order),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'admin-1',
        companyId: 'company-1',
      }),
      deleteMany: createDeleteManyMock('users', 3, order),
    },
    auditLog: {
      create: createDeleteManyMock('auditLog', 1, order),
    },
    company: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'company-1',
        name: 'EvFleet',
        slug: 'evfleet',
      }),
      delete: createDeleteMock('company', order),
    },
  });

  const createService = () => {
    const deleteOrder: string[] = [];
    const tx = createTransactionClient(deleteOrder);
    const prisma = {
      $transaction: jest.fn().mockImplementation(async (callback: any) => {
        return callback(tx);
      }),
    };
    const companyBackupService = {
      createBackupWithClient: jest.fn().mockImplementation(async () => {
        deleteOrder.push('backup');
        return {
          identifier: 'company-evfleet-2026-04-01.json',
          fileName: 'company-evfleet-2026-04-01.json',
          filePath: 'storage/backups/companies/company-evfleet-2026-04-01.json',
          generatedAt: '2026-04-01T10:00:00.000Z',
          metadataDownloadAvailable: false,
        };
      }),
    };
    const auditService = {
      createEntry: jest.fn().mockImplementation(async (input: any) => {
        if (input.client) {
          deleteOrder.push('auditLog');
        }
      }),
    };

    const service = new CompanyDeletionService(
      prisma as any,
      companyBackupService as any,
      auditService as any,
    );

    return {
      service,
      prisma,
      deleteOrder,
      companyBackupService,
      auditService,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gera backup no mesmo fluxo transacional antes de excluir', async () => {
    const { service, companyBackupService } = createService();

    await service.deleteWithBackup(
      { id: 'company-1', name: 'EvFleet', slug: 'evfleet' },
      { userId: 'admin-1' },
    );

    expect(companyBackupService.createBackupWithClient).toHaveBeenCalledWith(
      expect.any(Object),
      'company-1',
      'admin-1',
    );
  });

  it('exclui em ordem segura e retorna resumo com contagem', async () => {
    const { service, deleteOrder, auditService } = createService();

    const result = await service.deleteWithBackup(
      { id: 'company-1', name: 'EvFleet', slug: 'evfleet' },
      { userId: 'admin-1' },
    );

    expect(deleteOrder).toEqual([
      'backup',
      'vehicleProfilePhotos',
      'vehicleChangeLogs',
      'vehicleDocuments',
      'trips',
      'fuelRecords',
      'debts',
      'maintenancePlans',
      'maintenanceRecords',
      'tireReadings',
      'drivers',
      'tires',
      'vehicles',
      'xmlInvoiceItems',
      'retailProductImportItems',
      'retailProductImports',
      'xmlInvoices',
      'xmlImportBatches',
      'payments',
      'webhookEvents',
      'subscriptions',
      'users',
      'branches',
      'company',
      'auditLog',
    ]);

    expect(result).toEqual({
      success: true,
      message: 'Empresa excluída com sucesso.',
      data: {
        company: {
          id: 'company-1',
          name: 'EvFleet',
        },
        backup: {
          identifier: 'company-evfleet-2026-04-01.json',
          fileName: 'company-evfleet-2026-04-01.json',
          filePath:
            'storage/backups/companies/company-evfleet-2026-04-01.json',
          generatedAt: '2026-04-01T10:00:00.000Z',
          metadataDownloadAvailable: false,
        },
        deleted: {
          company: 1,
          branches: 1,
          users: 3,
          subscriptions: 3,
          payments: 0,
          webhookEvents: 1,
          vehicles: 1,
          vehicleProfilePhotos: 1,
          vehicleChangeLogs: 1,
          drivers: 1,
          maintenanceRecords: 1,
          maintenancePlans: 1,
          debts: 1,
          fuelRecords: 1,
          trips: 1,
          vehicleDocuments: 1,
          tires: 1,
          tireReadings: 1,
          xmlImportBatches: 1,
          xmlInvoices: 1,
          xmlInvoiceItems: 1,
          retailProductImports: 1,
          retailProductImportItems: 1,
        },
      },
    });

    expect(auditService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE_COMPANY_WITH_BACKUP',
        entity: 'Company',
        entityId: 'company-1',
        performedByUserId: null,
        metadata: expect.objectContaining({
          companyName: 'EvFleet',
          companySlug: 'evfleet',
          backupFileName: 'company-evfleet-2026-04-01.json',
          backupFilePath:
            'storage/backups/companies/company-evfleet-2026-04-01.json',
          deletedSummary: expect.objectContaining({
            company: 1,
            branches: 1,
            users: 3,
          }),
          outcome: 'SUCCESS',
          executedAt: expect.any(String),
          performedByUserIdSnapshot: 'admin-1',
        }),
        client: expect.any(Object),
      }),
    );
  });

  it('retorna erro claro quando a exclusao falha por integridade relacional', async () => {
    const { service, prisma, companyBackupService, auditService } =
      createService();

    prisma.$transaction.mockRejectedValue({
      code: 'P2003',
      clientVersion: 'test',
      meta: {},
      name: 'PrismaClientKnownRequestError',
      message: 'Foreign key constraint failed',
    });

    await expect(
      service.deleteWithBackup(
        { id: 'company-1', name: 'EvFleet', slug: 'evfleet' },
        { userId: 'admin-1' },
      ),
    ).rejects.toMatchObject({
      response: {
        success: false,
        errorCode: 'COMPANY_DELETE_RELATIONAL_INTEGRITY_FAILED',
      },
    });

    expect(companyBackupService.createBackupWithClient).not.toHaveBeenCalled();
    expect(auditService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          outcome: 'FAILED',
        }),
        swallowErrors: true,
      }),
    );
  });

  it('bloqueia exclusao concorrente da mesma empresa', async () => {
    const { service, companyBackupService, prisma } = createService();
    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = createTransactionClient([]);
      tx.$queryRaw.mockResolvedValue([{ locked: false }]);
      return callback(tx);
    });

    await expect(
      service.deleteWithBackup(
        { id: 'company-1', name: 'EvFleet', slug: 'evfleet' },
        { userId: 'admin-1' },
      ),
    ).rejects.toMatchObject({
      response: {
        success: false,
        errorCode: 'COMPANY_DELETE_IN_PROGRESS',
      },
    });

    expect(companyBackupService.createBackupWithClient).not.toHaveBeenCalled();
  });

  it('retorna erro claro quando o backup falha e registra tentativa', async () => {
    const { service, companyBackupService, auditService } = createService();
    companyBackupService.createBackupWithClient.mockRejectedValue(
      new Error('Falha de escrita em disco.'),
    );

    await expect(
      service.deleteWithBackup(
        { id: 'company-1', name: 'EvFleet', slug: 'evfleet' },
        { userId: 'admin-1' },
      ),
    ).rejects.toMatchObject({
      response: {
        success: false,
        errorCode: 'COMPANY_BACKUP_FAILED',
      },
    });

    expect(auditService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          outcome: 'BACKUP_FAILED',
        }),
        swallowErrors: true,
      }),
    );
  });
});
