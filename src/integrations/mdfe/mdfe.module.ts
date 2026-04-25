import { Module } from '@nestjs/common';
import { MockMdfeProvider } from './mock-mdfe.provider';

export const MDFE_PROVIDER = 'MDFE_PROVIDER';

@Module({
  providers: [
    {
      provide: MDFE_PROVIDER,
      useClass: MockMdfeProvider,
    },
  ],
  exports: [MDFE_PROVIDER],
})
export class MdfeModule {}