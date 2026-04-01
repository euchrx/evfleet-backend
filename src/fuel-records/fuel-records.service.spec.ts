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
      findFuelImportGroupDuplicate: jest.fn(async () => ({ duplicate: false })),
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

  it('confirma a importacao de grupos consolidados e retorna resumo', async () => {
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
              lineIndex: 2,
              productCode: 'DIESEL-S10-2',
              productName: 'Diesel S10 aditivo',
              quantity: 60,
              unitPrice: 6.5,
              totalPrice: 390,
              detectedType: 'FUEL',
              importable: true,
              duplicate: false,
              detectedFuelType: 'S10',
              fuelDateTime: '2026-04-01T10:10:00.000Z',
            },
            {
              lineIndex: 3,
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
          consolidated: [
            {
              selected: true,
              groupKey:
                '11111111111111111111111111111111111111111111|RHV4H87|FUEL|S10',
              detectedType: 'FUEL',
              fuelType: 'S10',
              totalQuantity: 160,
              totalPrice: 1005,
              itemsCount: 2,
              duplicate: false,
              importable: true,
            },
          ],
        },
      ],
    });

    expect(prisma.fuelRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceNumber: '123',
          liters: 160,
          totalValue: 1005,
          km: 123456,
          station: 'Posto Teste',
          fuelType: FuelType.DIESEL,
          sourceInvoiceKey:
            '11111111111111111111111111111111111111111111',
          sourceInvoiceLineIndex: 1,
          sourceProductCode: 'DIESEL-S10',
          sourceItems: expect.arrayContaining([
            expect.objectContaining({
              lineIndex: 1,
              quantity: 100,
              unitPrice: 6.15,
            }),
            expect.objectContaining({
              lineIndex: 2,
              quantity: 60,
              unitPrice: 6.5,
            }),
          ]),
        }),
      }),
    );
    expect(result).toEqual({
      totalInvoicesRead: 1,
      totalItemsDetected: 3,
      totalGroups: 1,
      totalImported: 1,
      totalIgnored: 0,
      totalDuplicated: 0,
    });
  });
});
