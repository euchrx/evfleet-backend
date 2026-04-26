import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

type BuildDamdfeInput = {
  accessKey?: string | null;
  protocol?: string | null;
  status: string;
  series: number;
  number: number;
  issuedAt?: Date | null;
};

@Injectable()
export class DamdfeService {
  async buildPdf(input: BuildDamdfeInput): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(18).text('DAMDFE', { align: 'center' });
      doc.moveDown();

      doc.fontSize(12).text('Documento Auxiliar do MDF-e', {
        align: 'center',
      });

      doc.moveDown(2);

      doc.fontSize(11);
      doc.text(`Status: ${input.status}`);
      doc.text(`Série: ${input.series}`);
      doc.text(`Número: ${input.number}`);
      doc.text(`Chave de acesso: ${input.accessKey || 'Não disponível'}`);
      doc.text(`Protocolo: ${input.protocol || 'Não disponível'}`);
      doc.text(
        `Emissão: ${
          input.issuedAt ? input.issuedAt.toLocaleString('pt-BR') : 'Não disponível'
        }`,
      );

      doc.moveDown(2);
      doc.text('Documento gerado pelo EvFleet.', { align: 'center' });

      doc.end();
    });
  }
}