export type CompanyDeletionSummary = {
  company: number;
  branches: number;
  users: number;
  subscriptions: number;
  payments: number;
  webhookEvents: number;
  vehicles: number;
  vehicleProfilePhotos: number;
  vehicleChangeLogs: number;
  drivers: number;
  maintenanceRecords: number;
  maintenancePlans: number;
  debts: number;
  fuelRecords: number;
  trips: number;
  vehicleDocuments: number;
  tires: number;
  tireReadings: number;
  xmlImportBatches: number;
  xmlInvoices: number;
  xmlInvoiceItems: number;
  retailProductImports: number;
  retailProductImportItems: number;
};

export type CompanyDeletionBackupResult = {
  fileName: string;
  filePath: string;
  generatedAt: string;
};

export type CompanyDeletionResponse<T> = {
  success: true;
  message: string;
  data: T;
};

export type DeleteAuthorizationResponse = CompanyDeletionResponse<{
  company: {
    id: string;
    name: string;
    slug: string | null;
  };
  confirmationText: string;
}>;

export type DeleteWithBackupResponse = CompanyDeletionResponse<{
  company: {
    id: string;
    name: string;
  };
  backup: CompanyDeletionBackupResult;
  deleted: CompanyDeletionSummary;
}>;

export type CompanyDeletionErrorBody = {
  success: false;
  errorCode: string;
  message: string;
};
