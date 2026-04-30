import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

type BuildDamdfeInput = {
  accessKey: string | null;
  protocol: string | null;
  status: string;
  series: number;
  number: number;
  issuedAt: Date | null;

  companyName?: string | null;
  companyDocument?: string | null;
  vehiclePlate?: string | null;
  driverName?: string | null;
  origin?: string | null;
  destination?: string | null;
  cargoDescription?: string | null;
  cargoValue?: number | null;
  cargoQuantity?: number | null;
};

@Injectable()
export class DamdfeService {
  async buildPdf(input: BuildDamdfeInput): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        bufferPages: true,
      });

      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.drawHeader(doc, input);
      this.drawMdfeInfo(doc, input);
      this.drawAccessKey(doc, input);
      this.drawAuthorization(doc, input);
      this.drawTripInfo(doc, input);
      this.drawFooter(doc);

      doc.end();
    });
  }

  private formatDocument(value?: string | null) {
    const digits = String(value || '').replace(/\D/g, '');

    if (!digits) return '-';

    if (digits.length === 14) {
      return digits.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        '$1.$2.$3/$4-$5',
      );
    }

    if (digits.length === 11) {
      return digits.replace(
        /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
        '$1.$2.$3-$4',
      );
    }

    return digits;
  }

  private drawTripInfo(doc: PDFKit.PDFDocument, input: BuildDamdfeInput) {
    const y = 462;

    doc.rect(36, y, 523, 150).stroke();

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Dados da viagem', 48, y + 12);

    doc
      .fontSize(9)
      .font('Helvetica')
      .text(`Emitente: ${input.companyName || '-'}`, 48, y + 34)
      .text(`CNPJ: ${this.formatDocument(input.companyDocument)}`, 48, y + 50)
      .text(`Veículo: ${input.vehiclePlate || '-'}`, 48, y + 66)
      .text(`Motorista: ${input.driverName || '-'}`, 48, y + 82)
      .text(`Origem: ${input.origin || '-'}`, 48, y + 98)
      .text(`Destino: ${input.destination || '-'}`, 48, y + 114)
      .text(`Carga: ${input.cargoDescription || '-'}`, 48, y + 130);
  }

  private drawHeader(doc: PDFKit.PDFDocument, input: BuildDamdfeInput) {
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('DAMDFE', { align: 'center' });

    doc
      .fontSize(9)
      .font('Helvetica')
      .text('Documento Auxiliar do Manifesto Eletrônico de Documentos Fiscais', {
        align: 'center',
      });

    doc.moveDown(1);

    doc
      .rect(36, 78, 523, 58)
      .stroke();

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('MDF-e', 48, 90);

    doc
      .fontSize(9)
      .font('Helvetica')
      .text(`Série: ${input.series}`, 48, 108)
      .text(`Número: ${input.number}`, 160, 108)
      .text(`Status: ${this.statusLabel(input.status)}`, 300, 108);
  }

  private drawMdfeInfo(doc: PDFKit.PDFDocument, input: BuildDamdfeInput) {
    const y = 155;

    doc.rect(36, y, 523, 85).stroke();

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Informações do MDF-e', 48, y + 12);

    doc
      .fontSize(9)
      .font('Helvetica')
      .text(`Emissão: ${this.formatDate(input.issuedAt)}`, 48, y + 34)
      .text(`Chave: ${input.accessKey || '-'}`, 48, y + 52, {
        width: 490,
      });
  }

  private drawAccessKey(doc: PDFKit.PDFDocument, input: BuildDamdfeInput) {
    const y = 260;
    const accessKey = input.accessKey || '';

    doc.rect(36, y, 523, 92).stroke();

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Chave de acesso', 48, y + 12);

    doc
      .fontSize(13)
      .font('Courier-Bold')
      .text(this.formatAccessKey(accessKey), 48, y + 35, {
        width: 490,
        align: 'center',
      });

    doc
      .fontSize(8)
      .font('Helvetica')
      .text(
        'Consulte a autenticidade no portal nacional do MDF-e ou no site da SEFAZ autorizadora.',
        48,
        y + 68,
        { width: 490, align: 'center' },
      );
  }

  private drawAuthorization(doc: PDFKit.PDFDocument, input: BuildDamdfeInput) {
    const y = 372;

    doc.rect(36, y, 523, 70).stroke();

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Protocolo de autorização', 48, y + 12);

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(input.protocol || '-', 48, y + 34);
  }

  private drawFooter(doc: PDFKit.PDFDocument) {
    doc
      .fontSize(8)
      .font('Helvetica')
      .text(
        'Documento gerado pelo EvFleet. Este DAMDFE não substitui o XML autorizado.',
        36,
        780,
        { width: 523, align: 'center' },
      );
  }

  private formatDate(value: Date | null) {
    if (!value) return '-';

    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(value);
  }

  private formatAccessKey(value: string) {
    const digits = String(value || '').replace(/\D/g, '');

    if (!digits) return '-';

    return digits.replace(/(.{4})/g, '$1 ').trim();
  }

  private statusLabel(status: string) {
    const labels: Record<string, string> = {
      DRAFT: 'Rascunho',
      PROCESSING: 'Processando',
      AUTHORIZED: 'Autorizado',
      REJECTED: 'Rejeitado',
      CANCELED: 'Cancelado',
      CLOSED: 'Encerrado',
      ERROR: 'Erro',
    };

    return labels[status] || status;
  }
}