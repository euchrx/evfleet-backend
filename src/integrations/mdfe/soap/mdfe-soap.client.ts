import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';

type SendSoapInput = {
  url: string;
  soapAction?: string;
  xmlBody: string;
  pfxBuffer: Buffer;
  password: string;
};

@Injectable()
export class MdfeSoapClient {
  async post(input: SendSoapInput): Promise<string> {
    const client = this.createClient(input.pfxBuffer, input.password);

    const response = await client.post(input.url, input.xmlBody, {
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        ...(input.soapAction ? { SOAPAction: input.soapAction } : {}),
      },
      responseType: 'text',
      timeout: 30000,
    });

    return response.data;
  }

  private createClient(pfxBuffer: Buffer, password: string): AxiosInstance {
    const httpsAgent = new https.Agent({
      pfx: pfxBuffer,
      passphrase: password,
      rejectUnauthorized: true,
    });

    return axios.create({
      httpsAgent,
      validateStatus: (status) => status >= 200 && status < 500,
    });
  }
}