import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class DeleteRetailProductItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  itemIds!: string[];
}
