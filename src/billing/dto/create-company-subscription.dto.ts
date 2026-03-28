import { SubscriptionStatus } from '@prisma/client';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

type CompanySubscriptionInitialStatus = Extract<
  SubscriptionStatus,
  'TRIALING' | 'ACTIVE'
>;

export class CreateCompanySubscriptionDto {
  @IsUUID()
  planId: string;

  @IsOptional()
  @IsIn(['TRIALING', 'ACTIVE'])
  initialStatus?: CompanySubscriptionInitialStatus;
}
