import { MaintenanceRecordsService } from './maintenance-records.service';

describe('MaintenanceRecordsService', () => {
  function createService() {
    const prisma = {
      vehicle: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      maintenanceRecord: {
        findFirst: jest.fn(),
      },
    };

    const service = new MaintenanceRecordsService(prisma as any);

    return { service, prisma };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('coloca o veículo em manutenção quando existe manutenção pendente', async () => {
    const { service, prisma } = createService();

    prisma.vehicle.findUnique.mockResolvedValue({
      id: 'vehicle-1',
      status: 'ACTIVE',
    });
    prisma.maintenanceRecord.findFirst.mockResolvedValue({
      id: 'maintenance-1',
      status: 'OPEN',
    });

    await (service as any).syncVehicleStatusByMaintenance('vehicle-1');

    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: 'vehicle-1' },
      data: { status: 'MAINTENANCE' },
    });
  });

  it('retorna o veículo para ativo quando não existe manutenção pendente', async () => {
    const { service, prisma } = createService();

    prisma.vehicle.findUnique.mockResolvedValue({
      id: 'vehicle-1',
      status: 'MAINTENANCE',
    });
    prisma.maintenanceRecord.findFirst.mockResolvedValue(null);

    await (service as any).syncVehicleStatusByMaintenance('vehicle-1');

    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: 'vehicle-1' },
      data: { status: 'ACTIVE' },
    });
  });

  it('preserva veículo vendido mesmo se existir manutenção pendente', async () => {
    const { service, prisma } = createService();

    prisma.vehicle.findUnique.mockResolvedValue({
      id: 'vehicle-1',
      status: 'SOLD',
    });
    prisma.maintenanceRecord.findFirst.mockResolvedValue({
      id: 'maintenance-1',
      status: 'OPEN',
    });

    await (service as any).syncVehicleStatusByMaintenance('vehicle-1');

    expect(prisma.vehicle.update).not.toHaveBeenCalled();
  });
});
