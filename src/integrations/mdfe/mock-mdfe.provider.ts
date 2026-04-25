import { Injectable } from '@nestjs/common';
import {
  MdfeIssueInput,
  MdfeIssueResult,
  MdfeProvider,
} from './mdfe-provider.interface';

@Injectable()
export class MockMdfeProvider implements MdfeProvider {
  async issue(input: MdfeIssueInput): Promise<MdfeIssueResult> {
    return {
      status: 'AUTHORIZED',
      accessKey: `MOCK-${input.tripId}-${Date.now()}`,
      protocol: `PROTOCOLO-MOCK-${Date.now()}`,
      rawResponse: {
        mock: true,
        tripId: input.tripId,
        issuedAt: new Date().toISOString(),
      },
    };
  }

  async cancel(accessKey: string, reason: string): Promise<MdfeIssueResult> {
    return {
      status: 'AUTHORIZED',
      accessKey,
      rawResponse: {
        mock: true,
        event: 'CANCEL',
        reason,
        canceledAt: new Date().toISOString(),
      },
    };
  }

  async close(accessKey: string): Promise<MdfeIssueResult> {
    return {
      status: 'AUTHORIZED',
      accessKey,
      rawResponse: {
        mock: true,
        event: 'CLOSE',
        closedAt: new Date().toISOString(),
      },
    };
  }

  async getStatus(accessKey: string): Promise<MdfeIssueResult> {
    return {
      status: 'AUTHORIZED',
      accessKey,
      rawResponse: {
        mock: true,
        event: 'STATUS',
        checkedAt: new Date().toISOString(),
      },
    };
  }
}