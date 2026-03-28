import { IsOptional, IsString } from 'class-validator';

export class CheckPaymentDto {
  @IsString()
  order_nsu: string;

  @IsOptional()
  @IsString()
  transaction_nsu?: string;

  @IsOptional()
  @IsString()
  slug?: string;
}

