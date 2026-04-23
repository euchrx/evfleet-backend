import { PlanInterval, SubscriptionStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

type CompanySubscriptionInitialStatus = Extract<
  SubscriptionStatus,
  'DRAFT' | 'TRIALING' | 'ACTIVE'
>;

export class CreateCompanySubscriptionDto {
  @IsString()
  @Length(1, 191)
  planId!: string;

  @IsOptional()
  @IsIn(['DRAFT', 'TRIALING', 'ACTIVE'])
  initialStatus?: CompanySubscriptionInitialStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  graceDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  customPriceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  customVehicleLimit?: number;

  @IsOptional()
  @IsBoolean()
  isCustomConfiguration?: boolean;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  planNameSnapshot?: string;

  @IsOptional()
  @IsString()
  @Length(2, 40)
  planCodeSnapshot?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  priceCentsSnapshot?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  vehicleLimitSnapshot?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencySnapshot?: string;

  @IsOptional()
  @IsEnum(PlanInterval)
  intervalSnapshot?: PlanInterval;
}