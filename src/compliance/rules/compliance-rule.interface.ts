import type {
  DangerousProduct,
  Driver,
  Trip,
  TripProduct,
  Vehicle,
  VehicleDocument,
} from '@prisma/client';

export type ComplianceContext = {
  trip: Trip;
  vehicle: Vehicle;
  driver: Driver | null;
  products: Array<TripProduct & { dangerousProduct: DangerousProduct }>;
  documents: VehicleDocument[];
  generatedDocuments: Array<{
    type: string;
    status: string;
  }>;
};

export type ComplianceRuleResult = {
  ruleCode: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'BLOCKING';
  passed: boolean;
  metadata?: Record<string, unknown>;
};

export interface ComplianceRule {
  code: string;
  validate(context: ComplianceContext): Promise<ComplianceRuleResult>;
}