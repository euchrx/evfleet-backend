import { IsOptional, IsUUID } from 'class-validator';

export class CreateSubscriptionPaymentDto {
  @IsOptional()
  @IsUUID()
  planId?: string;
}
