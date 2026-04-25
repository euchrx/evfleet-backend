export type MdfeIssueInput = {
  tripId: string;
};

export type MdfeIssueResult = {
  status: 'AUTHORIZED' | 'REJECTED' | 'PROCESSING' | 'ERROR';
  accessKey?: string;
  protocol?: string;
  xmlUrl?: string;
  pdfUrl?: string;
  rejectionCode?: string;
  rejectionReason?: string;
  rawResponse?: unknown;
};

export interface MdfeProvider {
  issue(input: MdfeIssueInput): Promise<MdfeIssueResult>;
  cancel(accessKey: string, reason: string): Promise<MdfeIssueResult>;
  close(accessKey: string): Promise<MdfeIssueResult>;
  getStatus(accessKey: string): Promise<MdfeIssueResult>;
}