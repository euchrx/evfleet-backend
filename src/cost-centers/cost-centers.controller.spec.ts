import { Test, TestingModule } from '@nestjs/testing';
import { CostCentersController } from './cost-centers.controller';

describe('CostCentersController', () => {
  let controller: CostCentersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CostCentersController],
    }).compile();

    controller = module.get<CostCentersController>(CostCentersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
