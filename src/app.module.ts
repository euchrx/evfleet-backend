import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CompanyScopeInterceptor } from './auth/company-scope.interceptor';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { SubscriptionAccessGuard } from './auth/subscription-access.guard';
import { BillingModule } from './billing/billing.module';
import { BranchesModule } from './branches/branches.module';
import { CompaniesModule } from './companies/companies.module';
import { ComplianceModule } from './compliance/compliance.module';
import { DangerousProductsModule } from './dangerous-products/dangerous-products.module';
import { DebtsModule } from './debts/debts.module';
import { DriversModule } from './drivers/drivers.module';
import { FuelRecordsModule } from './fuel-records/fuel-records.module';
import { GeneratedDocumentsModule } from './generated-documents/generated-documents.module';
import { MaintenancePlansModule } from './maintenance-plans/maintenance-plans.module';
import { MaintenanceRecordsModule } from './maintenance-records/maintenance-records.module';
import { MenuVisibilityModule } from './menu-visibility/menu-visibility.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { RetailProductsModule } from './retail-products/retail-products.module';
import { SystemResetModule } from './system-reset/system-reset.module';
import { SupportModule } from './support/support.module';
import { SystemSettingsModule } from './system-settings/system-settings.module';
import { TireMovementsModule } from './tire-movements/tire-movements.module';
import { TiresModule } from './tires/tires.module';
import { TripsModule } from './trips/trips.module';
import { UsersModule } from './users/users.module';
import { VehicleDocumentsModule } from './vehicle-documents/vehicle-documents.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { XmlImportModule } from './xml-import/xml-import.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    VehiclesModule,
    BranchesModule,
    CompaniesModule,
    UsersModule,
    AuthModule,
    DriversModule,
    MaintenanceRecordsModule,
    ReportsModule,
    RetailProductsModule,
    DebtsModule,
    FuelRecordsModule,
    MaintenancePlansModule,
    TripsModule,
    VehicleDocumentsModule,
    TiresModule,
    TireMovementsModule,
    MenuVisibilityModule,
    SystemResetModule,
    SupportModule,
    SystemSettingsModule,
    BillingModule,
    XmlImportModule,
    DangerousProductsModule,
    ComplianceModule,
    GeneratedDocumentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: CompanyScopeInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: SubscriptionAccessGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}