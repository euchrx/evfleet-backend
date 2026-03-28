import { IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateSubscriptionCheckoutDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  redirectUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  webhookUrl?: string;

  @IsOptional()
  @IsObject()
  customer?: Record<string, unknown>;
}
