import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CompanyDeletionService } from './company-deletion.service';
import { CompanyBackupService } from './services/company-backup.service';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompanyBackupService, CompanyDeletionService],
})
export class CompaniesModule {}
