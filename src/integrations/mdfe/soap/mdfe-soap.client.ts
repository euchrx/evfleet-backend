import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';

type SendSoapInput = {
  url: string;
  soapAction?: string;
  xmlBody: string;
  pfxBuffer: Buffer;
  password: string;
  operation?: string;
};

@Injectable()
export class MdfeSoapClient {
  private readonly logger = new Logger(MdfeSoapClient.name);

  async post(input: SendSoapInput): Promise<string> {
    const client = this.createClient(input.pfxBuffer, input.password);
    const operation = input.operation || 'MDFE';

    this.logger.log(
      `Enviando SOAP MDF-e. operation=${operation} url=${input.url} action=${
        input.soapAction || 'SEM_ACTION'
      } bodyLength=${input.xmlBody.length}`,
    );

    const response = await client.post(
      input.url,
      Buffer.from(input.xmlBody, 'utf-8'),
      {
        headers: {
          'Content-Type': input.soapAction
            ? `application/soap+xml; charset=utf-8; action="${input.soapAction}"`
            : 'application/soap+xml; charset=utf-8',
        },
        responseType: 'text',
        transformResponse: [(data) => data],
        timeout: Number(process.env.MDFE_SOAP_TIMEOUT_MS || 30000),
        validateStatus: () => true,
      },
    );

    const data =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data ?? '');

    this.logger.log(
      `Resposta SOAP MDF-e. operation=${operation} httpStatus=${response.status} responseLength=${data.length}`,
    );

    if (response.status < 200 || response.status >= 300) {
      this.logger.warn(
        `SEFAZ retornou HTTP fora do esperado. operation=${operation} httpStatus=${response.status}`,
      );
    }

    return data;
  }

  private createClient(pfxBuffer: Buffer, password: string): AxiosInstance {
    const httpsAgent = new https.Agent({
      pfx: pfxBuffer,
      passphrase: password,
      rejectUnauthorized: process.env.MDFE_REJECT_UNAUTHORIZED !== 'false',
    });

    return axios.create({
      httpsAgent,
    });
  }
}