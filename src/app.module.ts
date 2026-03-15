import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { BranchesModule } from './branches/branches.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { DriversModule } from './drivers/drivers.module';
import { MaintenanceRecordsModule } from './maintenance-records/maintenance-records.module';
import { ReportsModule } from './reports/reports.module';
import { DebtsModule } from './debts/debts.module';
import { FuelRecordsModule } from './fuel-records/fuel-records.module';
import { MaintenancePlansModule } from './maintenance-plans/maintenance-plans.module';
import { TripsModule } from './trips/trips.module';
import { VehicleDocumentsModule } from './vehicle-documents/vehicle-documents.module';
import { TiresModule } from './tires/tires.module';
import { MenuVisibilityModule } from './menu-visibility/menu-visibility.module';

@Module({
  imports: [
    PrismaModule,
    VehiclesModule,
    BranchesModule,
    UsersModule,
    AuthModule,
    DriversModule,
    MaintenanceRecordsModule,
    ReportsModule,
    DebtsModule,
    FuelRecordsModule,
    MaintenancePlansModule,
    TripsModule,
    VehicleDocumentsModule,
    TiresModule,
    MenuVisibilityModule,
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard }, // ✅ guard global
  ],
})
export class AppModule { }
