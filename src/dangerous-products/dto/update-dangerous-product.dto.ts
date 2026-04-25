import { PartialType } from '@nestjs/mapped-types';
import { CreateDangerousProductDto } from './create-dangerous-product.dto';

export class UpdateDangerousProductDto extends PartialType(
  CreateDangerousProductDto,
) {}