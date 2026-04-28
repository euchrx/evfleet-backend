export type MdfeIssueInput = {
  tripId: string;
};

export type MdfeCloseInput = {
  accessKey: string;
  protocol?: string;
  cityIbgeCode: string;
  state: string;
  closedAt?: Date;
};

export type MdfeCancelInput = {
  accessKey: string;
  protocol?: string;
  reason: string;
};

export type MdfeProviderStatus =
  | 'AUTHORIZED'
  | 'REJECTED'
  | 'PROCESSING'
  | 'ERROR'
  | 'CANCELED'
  | 'CLOSED';

export type MdfeIssueResult = {
  status: MdfeProviderStatus;
  accessKey?: string;
  protocol?: string;
  authorizedAt?: Date;
  xmlUrl?: string;
  pdfUrl?: string;
  requestXml?: string;
  authorizedXml?: string;
  responseXml?: string;
  rejectionCode?: string;
  rejectionReason?: string;
  protMdfeXml?: string;
  rawResponse?: unknown;
};

export interface MdfeProvider {
  issue(input: MdfeIssueInput): Promise<MdfeIssueResult>;

  cancel(input: MdfeCancelInput): Promise<MdfeIssueResult>;

  close(input: MdfeCloseInput): Promise<MdfeIssueResult>;

  getStatus(accessKey: string): Promise<MdfeIssueResult>;
}
