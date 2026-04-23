import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class SyncVehicleImplementsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2, {
    message: 'É permitido vincular no máximo 2 implementos ao veículo.',
  })
  @ArrayUnique({
    message: 'Não é permitido informar o mesmo implemento mais de uma vez.',
  })
  @IsUUID('4', { each: true, message: 'Todos os implementos devem ser UUID válidos.' })
  implementIds?: string[];
}