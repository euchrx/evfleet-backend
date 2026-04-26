import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MockMdfeProvider } from './mock-mdfe.provider';
import { SefazMdfeProvider } from './sefaz-mdfe.provider';
import { MdfeXmlBuilder } from './xml/mdfe-xml.builder';
import { MdfeXmlSignerService } from './xml/mdfe-xml-signer.service';
import { MdfeSoapClient } from './soap/mdfe-soap.client';
import { MdfeResponseParserService } from './xml/mdfe-response-parser.service';
import { MDFE_PROVIDER } from 'src/mdfe/mdfe.constants';

@Module({
  imports: [PrismaModule],
  providers: [
    MockMdfeProvider,
    SefazMdfeProvider,
    MdfeXmlBuilder,
    MdfeXmlSignerService,
    MdfeSoapClient,
    MdfeResponseParserService,
    {
      provide: MDFE_PROVIDER,
      useFactory: (
        mockProvider: MockMdfeProvider,
        sefazProvider: SefazMdfeProvider,
      ) => {
        const provider = process.env.MDFE_PROVIDER ?? 'MOCK';

        switch (provider.toUpperCase()) {
          case 'SEFAZ':
            return sefazProvider;

          case 'MOCK':
          default:
            return mockProvider;
        }
      },
      inject: [MockMdfeProvider, SefazMdfeProvider],
    },
  ],
  exports: [MDFE_PROVIDER],
})
export class MdfeModule {}