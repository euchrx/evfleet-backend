import { IsUUID } from 'class-validator';

export class CreateCompanySubscriptionDto {
  @IsUUID()
  planId: string;
}

