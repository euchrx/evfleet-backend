import AdmZip from 'adm-zip';
import { XmlImportBatchStatus } from '@prisma/client';
import { XmlImportService } from './xml-import.service';

type StoredInvoice = {
  id: string;
  invoiceKey: string;
  data: any;
};

function createPrismaMock(initialInvoiceKeys: string[] = []) {
  const state = {
    branchExists: true,
    batches: [] as any[],
    invoices: initialInvoiceKeys.map<StoredInvoice>((invoiceKey, index) => ({
      id: `existing_${index + 1}`,
      invoiceKey,
      data: {
        invoiceKey,
      },
    })),
  };

  const prisma = {
    branch: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (!state.branchExists) return null;
        if (where?.id && where?.companyId) return { id: where.id };
        return null;
      }),
    },
    xmlImportBatch: {
      create: jest.fn(async ({ data }: any) => {
        const created = {
          id: `batch_${state.batches.length + 1}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.batches.push(created);
        return created;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = state.batches.findIndex((item) => item.id === where.id);
        if (idx < 0) throw new Error('Batch not found');
        state.batches[idx] = {
          ...state.batches[idx],
          ...data,
          updatedAt: new Date(),
        };
        return state.batches[idx];
      }),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    xmlInvoice: {
      findUnique: jest.fn(async ({ where }: any) => {
        const found = state.invoices.find((item) => item.invoiceKey === where.invoiceKey);
        if (!found) return null;
        return { id: found.id };
      }),
      create: jest.fn(async ({ data }: any) => {
        const created: StoredInvoice = {
          id: `inv_${state.invoices.length + 1}`,
          invoiceKey: data.invoiceKey,
          data,
        };
        state.invoices.push(created);
        return created;
      }),
      findMany: jest.fn(),
    },
  };

  return {
    prisma: prisma as any,
    state,
  };
}

function zipFromEntries(entries: Array<{ name: string; content: string }>) {
  const zip = new AdmZip();
  for (const entry of entries) {
    zip.addFile(entry.name, Buffer.from(entry.content, 'utf-8'));
  }
  return zip.toBuffer();
}

function createValidNfeXml(params: {
  key: string;
  number: string;
  series: string;
  issuedAt?: string;
  issuerName?: string;
  issuerDocument?: string;
  recipientName?: string;
  recipientDocument?: string;
  totalAmount?: string;
  protocolNumber?: string;
  items?: Array<{
    productCode: string;
    description: string;
    quantity: string;
    unitValue: string;
    totalValue: string;
  }>;
}) {
  const items = params.items ?? [
    {
      productCode: 'P001',
      description: 'Produto teste',
      quantity: '2.0000',
      unitValue: '10.0000',
      totalValue: '20.00',
    },
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe${params.key}">
      <ide>
        <nNF>${params.number}</nNF>
        <serie>${params.series}</serie>
        <dhEmi>${params.issuedAt ?? '2026-03-30T10:00:00-03:00'}</dhEmi>
      </ide>
      <emit>
        <xNome>${params.issuerName ?? 'Emitente Teste LTDA'}</xNome>
        <CNPJ>${params.issuerDocument ?? '12345678000100'}</CNPJ>
      </emit>
      <dest>
        <xNome>${params.recipientName ?? 'Destinatario Teste LTDA'}</xNome>
        <CNPJ>${params.recipientDocument ?? '00987654000199'}</CNPJ>
      </dest>
      <total>
        <ICMSTot>
          <vNF>${params.totalAmount ?? '20.00'}</vNF>
        </ICMSTot>
      </total>
      ${items
        .map(
          (item, index) => `<det nItem="${index + 1}">
        <prod>
          <cProd>${item.productCode}</cProd>
          <xProd>${item.description}</xProd>
          <qCom>${item.quantity}</qCom>
          <vUnCom>${item.unitValue}</vUnCom>
          <vProd>${item.totalValue}</vProd>
        </prod>
      </det>`,
        )
        .join('\n')}
    </infNFe>
  </NFe>
  <protNFe>
    <infProt>
      <chNFe>${params.key}</chNFe>
      <nProt>${params.protocolNumber ?? '135260000000001'}</nProt>
      <cStat>100</cStat>
    </infProt>
  </protNFe>
</nfeProc>`;
}

describe('XmlImportService', () => {
  it('importa ZIP com multiplos XMLs validos', async () => {
    const { prisma } = createPrismaMock();
    const service = new XmlImportService(prisma);
    const zipBuffer = zipFromEntries([
      {
        name: '202601/nfe_1.xml',
        content: createValidNfeXml({
          key: '11111111111111111111111111111111111111111111',
          number: '1',
          series: '1',
        }),
      },
      {
        name: '202601/nfe_2.xml',
        content: createValidNfeXml({
          key: '22222222222222222222222222222222222222222222',
          number: '2',
          series: '1',
        }),
      },
    ]);

    const summary = await service.importZip({
      companyId: 'company_1',
      fileName: 'notas.zip',
      zipBuffer,
    });

    expect(summary.totalFiles).toBe(2);
    expect(summary.importedFiles).toBe(2);
    expect(summary.duplicateFiles).toBe(0);
    expect(summary.errorFiles).toBe(0);
    expect(summary.status).toBe(XmlImportBatchStatus.COMPLETED);
    expect(prisma.xmlInvoice.create).toHaveBeenCalledTimes(2);
  });

  it('ignora arquivos nao XML', async () => {
    const { prisma } = createPrismaMock();
    const service = new XmlImportService(prisma);
    const zipBuffer = zipFromEntries([
      {
        name: '202601/nfe_1.xml',
        content: createValidNfeXml({
          key: '33333333333333333333333333333333333333333333',
          number: '3',
          series: '1',
        }),
      },
      {
        name: '202601/readme.txt',
        content: 'arquivo texto',
      },
    ]);

    const summary = await service.importZip({
      companyId: 'company_1',
      fileName: 'mixed.zip',
      zipBuffer,
    });

    expect(summary.totalFiles).toBe(1);
    expect(summary.importedFiles).toBe(1);
    expect(prisma.xmlImportBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalFiles: 1,
        }),
      }),
    );
  });

  it('conta duplicidade por invoiceKey e nao reimporta', async () => {
    const duplicateKey = '44444444444444444444444444444444444444444444';
    const { prisma } = createPrismaMock([duplicateKey]);
    const service = new XmlImportService(prisma);
    const zipBuffer = zipFromEntries([
      {
        name: '202601/nfe_dup.xml',
        content: createValidNfeXml({
          key: duplicateKey,
          number: '4',
          series: '1',
        }),
      },
    ]);

    const summary = await service.importZip({
      companyId: 'company_1',
      fileName: 'dup.zip',
      zipBuffer,
    });

    expect(summary.totalFiles).toBe(1);
    expect(summary.importedFiles).toBe(0);
    expect(summary.duplicateFiles).toBe(1);
    expect(summary.errorFiles).toBe(0);
    expect(prisma.xmlInvoice.create).not.toHaveBeenCalled();
  });

  it('salva itens da nota fiscal', async () => {
    const { prisma } = createPrismaMock();
    const service = new XmlImportService(prisma);
    const zipBuffer = zipFromEntries([
      {
        name: '202602/nfe_items.xml',
        content: createValidNfeXml({
          key: '55555555555555555555555555555555555555555555',
          number: '5',
          series: '1',
          items: [
            {
              productCode: 'IT01',
              description: 'Item 01',
              quantity: '1.0000',
              unitValue: '100.0000',
              totalValue: '100.00',
            },
            {
              productCode: 'IT02',
              description: 'Item 02',
              quantity: '2.0000',
              unitValue: '50.0000',
              totalValue: '100.00',
            },
          ],
        }),
      },
    ]);

    await service.importZip({
      companyId: 'company_1',
      fileName: 'items.zip',
      zipBuffer,
    });

    expect(prisma.xmlInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: {
            create: expect.arrayContaining([
              expect.objectContaining({
                productCode: 'IT01',
                description: 'Item 01',
              }),
              expect.objectContaining({
                productCode: 'IT02',
                description: 'Item 02',
              }),
            ]),
          },
        }),
      }),
    );
  });

  it('registra erro em XML invalido sem derrubar lote inteiro', async () => {
    const { prisma } = createPrismaMock();
    const service = new XmlImportService(prisma);
    const zipBuffer = zipFromEntries([
      {
        name: '202602/invalid.xml',
        content: '<root><semNFe>true</semNFe></root>',
      },
      {
        name: '202602/valid.xml',
        content: createValidNfeXml({
          key: '66666666666666666666666666666666666666666666',
          number: '6',
          series: '1',
        }),
      },
    ]);

    const summary = await service.importZip({
      companyId: 'company_1',
      fileName: 'partial.zip',
      zipBuffer,
    });

    expect(summary.totalFiles).toBe(2);
    expect(summary.importedFiles).toBe(1);
    expect(summary.errorFiles).toBe(1);
    expect(summary.status).toBe(XmlImportBatchStatus.COMPLETED_WITH_ERRORS);
  });

  it('retorna resumo correto do lote', async () => {
    const duplicateKey = '77777777777777777777777777777777777777777777';
    const { prisma } = createPrismaMock([duplicateKey]);
    const service = new XmlImportService(prisma);
    const zipBuffer = zipFromEntries([
      {
        name: '202603/ok.xml',
        content: createValidNfeXml({
          key: '88888888888888888888888888888888888888888888',
          number: '8',
          series: '1',
        }),
      },
      {
        name: '202603/dup.xml',
        content: createValidNfeXml({
          key: duplicateKey,
          number: '7',
          series: '1',
        }),
      },
      {
        name: '202603/invalid.xml',
        content: '<xml>quebrado</xml>',
      },
      {
        name: '202603/not-xml.json',
        content: '{"a":1}',
      },
    ]);

    const summary = await service.importZip({
      companyId: 'company_1',
      fileName: 'summary.zip',
      zipBuffer,
    });

    expect(summary.batchId).toBeTruthy();
    expect(summary.totalFiles).toBe(3);
    expect(summary.importedFiles).toBe(1);
    expect(summary.duplicateFiles).toBe(1);
    expect(summary.errorFiles).toBe(1);
    expect(summary.status).toBe(XmlImportBatchStatus.COMPLETED_WITH_ERRORS);
  });
});

