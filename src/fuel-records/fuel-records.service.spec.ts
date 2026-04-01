import { FuelType } from '@prisma/client';
import { FuelRecordsService } from './fuel-records.service';

describe('FuelRecordsService', () => {
  function createService() {
    const prisma = {
      fuelRecord: {
        create: jest.fn(async ({ data }: any) => ({
          id: 'fuel_1',
          ...data,
          vehicle: {
            id: data.vehicleId,
            branch: null,
            costCenter: null,
          },
          driver: null,
        })),
        findFirst: jest.fn(async () => null),
      },
      vehicle: {
        findFirst: jest.fn(async () => ({ id: 'vehicle_1', currentKm: 120000 })),
        findUnique: jest.fn(async () => ({ currentKm: 120000, vehicleType: 'HEAVY' })),
        update: jest.fn(async () => ({})),
      },
      driver: {
        findUnique: jest.fn(async () => ({ id: 'driver_1' })),
      },
      maintenanceRecord: {
        findFirst: jest.fn(async () => null),
      },
    };

    const xmlImportService = {
      previewFuelXmlFiles: jest.fn(),
      findFuelImportDuplicate: jest.fn(async () => ({ duplicate: false })),
    };

    return {
      service: new FuelRecordsService(prisma as any, xmlImportService as any),
      prisma,
      xmlImportService,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('confirma a importacao de itens selecionados e retorna resumo', async () => {
    const { service, prisma } = createService();

    const result = await service.confirmXmlImport('company_1', {
      invoices: [
        {
          invoiceKey: '11111111111111111111111111111111111111111111',
          invoiceNumber: '123',
          issuedAt: '2026-04-01T10:00:00.000Z',
          supplierName: 'Posto Teste',
          supplierDocument: '12345678000100',
          plate: 'RHV4H87',
          odometer: 123456,
          items: [
            {
              selected: true,
              lineIndex: 1,
              productCode: 'DIESEL-S10',
              productName: 'Diesel S10',
              quantity: 100,
              unitPrice: 6.15,
              totalPrice: 615,
              detectedType: 'FUEL',
              importable: true,
              duplicate: false,
              detectedFuelType: 'S10',
              fuelDateTime: '2026-04-01T10:15:00.000Z',
            },
            {
              selected: false,
              lineIndex: 2,
              productCode: 'OUTRO',
              productName: 'Agua Mineral',
              quantity: 1,
              unitPrice: 4,
              totalPrice: 4,
              detectedType: 'OTHER',
              importable: false,
              duplicate: false,
            },
          ],
        },
      ],
    });

    expect(prisma.fuelRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceNumber: '123',
          liters: 100,
          totalValue: 615,
          km: 123456,
          station: 'Posto Teste',
          fuelType: FuelType.DIESEL,
          sourceInvoiceKey:
            '11111111111111111111111111111111111111111111',
          sourceInvoiceLineIndex: 1,
          sourceProductCode: 'DIESEL-S10',
        }),
      }),
    );
    expect(result).toEqual({
      totalInvoicesRead: 1,
      totalItemsDetected: 2,
      totalImported: 1,
      totalIgnored: 1,
      totalDuplicated: 0,
    });
  });
});

