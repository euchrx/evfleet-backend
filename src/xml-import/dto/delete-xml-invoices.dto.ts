import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class DeleteXmlInvoicesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  invoiceIds: string[];
}

