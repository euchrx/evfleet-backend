import AdmZip from 'adm-zip';
import {
  Prisma,
  XmlImportBatchStatus,
  XmlProcessingStatus,
  XmlProcessingType,
} from '@prisma/client';
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
  plate?: string;
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
      ${
        params.plate
          ? `<infAdic><infCpl>PLACA ${params.plate}</infCpl></infAdic>`
          : ''
      }
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

  it('classifica item de perfumaria como RETAIL_PRODUCT', async () => {
    const { prisma } = createPrismaMock();
    const service = new XmlImportService(prisma);
    const zipBuffer = zipFromEntries([
      {
        name: '202602/nfe_perfumaria.xml',
        content: createValidNfeXml({
          key: '56565656565656565656565656565656565656565656',
          number: '56',
          series: '1',
          items: [
            {
              productCode: 'PF01',
              description: 'Shampoo perfumaria premium',
              quantity: '1.0000',
              unitValue: '19.9000',
              totalValue: '19.90',
            },
          ],
        }),
      },
    ]);

    await service.importZip({
      companyId: 'company_1',
      fileName: 'perfumaria.zip',
      zipBuffer,
    });

    expect(prisma.xmlInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          processingType: XmlProcessingType.RETAIL_PRODUCT,
        }),
      }),
    );
  });

  it('classifica item de conveniencia como RETAIL_PRODUCT', async () => {
    const { prisma } = createPrismaMock();
    const service = new XmlImportService(prisma);
    const zipBuffer = zipFromEntries([
      {
        name: '202602/nfe_conveniencia.xml',
        content: createValidNfeXml({
          key: '67676767676767676767676767676767676767676767',
          number: '67',
          series: '1',
          items: [
            {
              productCode: 'CV01',
              description: 'Refrigerante lata conveniencia',
              quantity: '2.0000',
              unitValue: '6.5000',
              totalValue: '13.00',
            },
          ],
        }),
      },
    ]);

    await service.importZip({
      companyId: 'company_1',
      fileName: 'conveniencia.zip',
      zipBuffer,
    });

    expect(prisma.xmlInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          processingType: XmlProcessingType.RETAIL_PRODUCT,
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

  it('processa nota RETAIL_PRODUCT e cria importacao de produtos de loja', async () => {
    const tx = {
      vehicle: {
        findFirst: jest.fn(async () => ({ id: 'vehicle_1', branchId: 'branch_1' })),
      },
      retailProductImport: {
        create: jest.fn(async () => ({ id: 'retail_import_1' })),
      },
      xmlInvoice: {
        update: jest.fn(async () => ({
          id: 'invoice_1',
          processingStatus: XmlProcessingStatus.PROCESSED,
          linkedRetailProductImportId: 'retail_import_1',
        })),
      },
    };

    const prisma = {
      xmlInvoice: {
        findFirst: jest.fn(async () => ({
          id: 'invoice_1',
          invoiceKey: '99999999999999999999999999999999999999999999',
          number: '99',
          series: '1',
          issuedAt: new Date('2026-03-30T10:00:00-03:00'),
          issuerName: 'Loja Conveniencia',
          issuerDocument: '12345678000100',
          totalAmount: 59.9,
          branchId: null,
          rawXml: createValidNfeXml({
            key: '99999999999999999999999999999999999999999999',
            number: '99',
            series: '1',
            plate: 'RHV4H87',
            items: [
              {
                code: 'CV01',
                description: 'Refrigerante',
                quantity: 2,
                unitValue: 6.5,
                totalValue: 13,
              },
            ],
          }),
          processingType: XmlProcessingType.RETAIL_PRODUCT,
          processingStatus: XmlProcessingStatus.SUGGESTED,
          items: [
            {
              productCode: 'CV01',
              description: 'Refrigerante',
              quantity: 2,
              unitValue: 6.5,
              totalValue: 13,
            },
          ],
        })),
      },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    const service = new XmlImportService(prisma as any);
    const result = await service.processInvoiceAsRetailProduct('company_1', 'invoice_1');

    expect(tx.retailProductImport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 'company_1',
          branchId: 'branch_1',
          vehicleId: 'vehicle_1',
          sourcePlate: 'RHV4H87',
          xmlInvoiceId: 'invoice_1',
          supplierName: 'Loja Conveniencia',
        }),
      }),
    );
    expect(tx.xmlInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'invoice_1' },
        data: expect.objectContaining({
          processingStatus: XmlProcessingStatus.PROCESSED,
          linkedRetailProductImportId: 'retail_import_1',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        invoiceId: 'invoice_1',
        processingStatus: XmlProcessingStatus.PROCESSED,
        createdRecordType: 'RETAIL_PRODUCT_IMPORT',
        createdRecordId: 'retail_import_1',
      }),
    );
  });

  it('gera preview por item para abastecimentos com combustivel, arla e outros itens', async () => {
    const prisma = {
      fuelRecord: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'duplicated_item' })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'duplicated_group_arla' }),
        findMany: jest.fn(async () => []),
      },
    };

    const service = new XmlImportService(prisma as any);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe55555555555555555555555555555555555555555555">
      <ide>
        <nNF>321</nNF>
        <serie>1</serie>
        <dhEmi>2026-04-01T08:30:00-03:00</dhEmi>
      </ide>
      <emit>
        <xNome>Posto Avenida</xNome>
        <CNPJ>12345678000100</CNPJ>
      </emit>
      <infAdic>
        <infCpl>PLACA: RHV4H87 KM: 123456</infCpl>
      </infAdic>
      <total>
        <ICMSTot>
          <vNF>742.50</vNF>
        </ICMSTot>
      </total>
      <det nItem="1">
        <prod>
          <cProd>001</cProd>
          <xProd>Diesel S10</xProd>
          <qCom>100.0000</qCom>
          <vUnCom>6.1500</vUnCom>
          <vProd>615.00</vProd>
        </prod>
        <infAdProd>BICO 05 BOMBA 02 01/04/2026 08:15:00</infAdProd>
      </det>
      <det nItem="2">
        <prod>
          <cProd>001-A</cProd>
          <xProd>Diesel S10 aditivado</xProd>
          <qCom>60.0000</qCom>
          <vUnCom>6.2000</vUnCom>
          <vProd>372.00</vProd>
        </prod>
      </det>
      <det nItem="3">
        <prod>
          <cProd>002</cProd>
          <xProd>ARLA 32</xProd>
          <qCom>50.0000</qCom>
          <vUnCom>2.5000</vUnCom>
          <vProd>125.00</vProd>
        </prod>
      </det>
      <det nItem="4">
        <prod>
          <cProd>003</cProd>
          <xProd>Agua mineral</xProd>
          <qCom>1.0000</qCom>
          <vUnCom>2.5000</vUnCom>
          <vProd>2.50</vProd>
        </prod>
      </det>
    </infNFe>
  </NFe>
  <protNFe>
    <infProt>
      <chNFe>55555555555555555555555555555555555555555555</chNFe>
      <cStat>100</cStat>
    </infProt>
  </protNFe>
</nfeProc>`;

    const preview = await service.previewFuelXmlFiles({
      companyId: 'company_1',
      files: [{ buffer: Buffer.from(xml, 'utf-8'), originalname: 'nfe.xml' }],
    });

    expect(preview.summary).toEqual({
      totalInvoices: 1,
      totalItems: 4,
      importableItems: 2,
      duplicateItems: 1,
      otherItems: 1,
    });
    expect(preview.invoices[0]).toEqual(
      expect.objectContaining({
        invoiceKey: '55555555555555555555555555555555555555555555',
        invoiceNumber: '321',
        supplierName: 'Posto Avenida',
        plate: 'RHV4H87',
        odometer: 123456,
      }),
    );
    expect(preview.invoices[0].items).toEqual([
      expect.objectContaining({
        lineIndex: 1,
        detectedType: 'FUEL',
        importable: true,
        duplicate: false,
        detectedFuelType: 'S10',
        nozzleNumber: '05',
        pumpNumber: '02',
      }),
      expect.objectContaining({
        lineIndex: 2,
        detectedType: 'FUEL',
        importable: true,
        duplicate: false,
        detectedFuelType: 'S10',
      }),
      expect.objectContaining({
        lineIndex: 3,
        detectedType: 'ARLA',
        importable: true,
        duplicate: true,
      }),
      expect.objectContaining({
        lineIndex: 4,
        detectedType: 'OTHER',
        importable: false,
        duplicate: false,
      }),
    ]);
    expect(preview.invoices[0].consolidated).toEqual([
      expect.objectContaining({
        groupKey:
          '55555555555555555555555555555555555555555555|RHV4H87|FUEL|S10',
        detectedType: 'FUEL',
        fuelType: 'S10',
        totalQuantity: 160,
        totalPrice: 987,
        itemsCount: 2,
        duplicate: false,
        importable: true,
      }),
      expect.objectContaining({
        groupKey:
          '55555555555555555555555555555555555555555555|RHV4H87|ARLA|ARLA32',
        detectedType: 'ARLA',
        fuelType: 'ARLA32',
        totalQuantity: 50,
        totalPrice: 125,
        itemsCount: 1,
        duplicate: true,
        importable: true,
      }),
    ]);
  });

  it('gera preview de produtos ignorando combustivel e arla e classificando categorias', async () => {
    const prisma = {
      retailProductImportItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const service = new XmlImportService(prisma as any);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe66666666666666666666666666666666666666666666">
      <ide>
        <nNF>654</nNF>
        <serie>1</serie>
        <dhEmi>2026-04-01T08:30:00-03:00</dhEmi>
      </ide>
      <emit>
        <xNome>Loja do Posto</xNome>
        <CNPJ>12345678000100</CNPJ>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>001</cProd>
          <xProd>Shampoo automotivo premium</xProd>
          <qCom>2.0000</qCom>
          <vUnCom>15.0000</vUnCom>
          <vProd>30.00</vProd>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>002</cProd>
          <xProd>Diesel S10</xProd>
          <qCom>100.0000</qCom>
          <vUnCom>6.1500</vUnCom>
          <vProd>615.00</vProd>
        </prod>
      </det>
      <det nItem="3">
        <prod>
          <cProd>003</cProd>
          <xProd>Óleo lubrificante 15W40</xProd>
          <qCom>1.0000</qCom>
          <vUnCom>45.0000</vUnCom>
          <vProd>45.00</vProd>
        </prod>
      </det>
      <det nItem="4">
        <prod>
          <cProd>004</cProd>
          <xProd>ARLA 32</xProd>
          <qCom>20.0000</qCom>
          <vUnCom>2.5000</vUnCom>
          <vProd>50.00</vProd>
        </prod>
      </det>
    </infNFe>
  </NFe>
  <protNFe>
    <infProt>
      <chNFe>66666666666666666666666666666666666666666666</chNFe>
      <cStat>100</cStat>
    </infProt>
  </protNFe>
</nfeProc>`;

    const preview = await service.previewProductXmlFiles({
      companyId: 'company_1',
      files: [{ buffer: Buffer.from(xml, 'utf-8'), originalname: 'produtos.xml' }],
    });

    expect(preview.summary).toEqual({
      totalInvoices: 1,
      totalItems: 4,
      importableItems: 2,
      duplicateItems: 0,
      ignoredFuelItems: 2,
    });
    expect(preview.invoices[0].items).toEqual([
      expect.objectContaining({
        lineIndex: 1,
        detectedType: 'PRODUCT',
        category: 'PERFUMARIA',
      }),
      expect.objectContaining({
        lineIndex: 3,
        detectedType: 'PRODUCT',
        category: 'LUBRIFICANTES',
      }),
    ]);
  });

  it('confirma importacao de produtos por item e bloqueia duplicidade', async () => {
    const tx = {
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({ id: 'vehicle_1', branchId: 'branch_1' }),
      },
      retailProductImport: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'retail_import_1' }),
        update: jest.fn(),
      },
      retailProductImportItem: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const prisma = {
      retailProductImportItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    const service = new XmlImportService(prisma as any);

    const result = await service.confirmProductXmlPreview('company_1', {
      invoices: [
        {
          fileName: 'produtos.xml',
          invoiceKey: '77777777777777777777777777777777777777777777',
          invoiceNumber: '777',
          issuedAt: '2026-04-01T08:30:00.000Z',
          supplierName: 'Loja do Posto',
          supplierDocument: '12345678000100',
          plate: 'RHV4H87',
          items: [
            {
              selected: true,
              lineIndex: 1,
              productCode: 'PRD-1',
              productName: 'Shampoo automotivo',
              quantity: 2,
              unitPrice: 15,
              totalPrice: 30,
              detectedType: 'PRODUCT',
              importable: true,
              duplicate: false,
              duplicateReason: null,
              category: 'PERFUMARIA',
            },
            {
              selected: false,
              lineIndex: 2,
              productCode: 'PRD-2',
              productName: 'Sabonete',
              quantity: 1,
              unitPrice: 6,
              totalPrice: 6,
              detectedType: 'PRODUCT',
              importable: true,
              duplicate: false,
              duplicateReason: null,
              category: 'PERFUMARIA',
            },
          ],
        },
      ],
    });

    expect(tx.retailProductImport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 'company_1',
          sourceInvoiceKey: '77777777777777777777777777777777777777777777',
          sourcePlate: 'RHV4H87',
          vehicleId: 'vehicle_1',
          branchId: 'branch_1',
        }),
      }),
    );
    expect(tx.retailProductImportItem.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            description: 'Shampoo automotivo',
            category: 'PERFUMARIA',
            sourceInvoiceLineIndex: 1,
          }),
        ]),
      }),
    );
    expect(result).toEqual({
      totalInvoicesRead: 1,
      totalItemsDetected: 2,
      totalImported: 1,
      totalIgnored: 1,
      totalDuplicated: 0,
    });
  });

  it('lista produtos com veiculo resolvido pela placa salva ou pelo XML legado', async () => {
    const prisma = {
      retailProductImportItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'item_1',
            productCode: 'PRD-1',
            description: 'Shampoo automotivo',
            category: 'PERFUMARIA',
            quantity: new Prisma.Decimal(2),
            unitValue: new Prisma.Decimal(15),
            totalValue: new Prisma.Decimal(30),
            createdAt: new Date('2026-04-01T10:00:00.000Z'),
            retailProductImport: {
              id: 'import_1',
              sourcePlate: null,
              supplierName: 'Loja do Posto',
              supplierDocument: '12345678000100',
              invoiceNumber: '777',
              invoiceSeries: null,
              issuedAt: new Date('2026-04-01T08:30:00.000Z'),
              totalAmount: new Prisma.Decimal(30),
              vehicle: null,
              branch: null,
              xmlInvoice: {
                id: 'xml_1',
                invoiceKey: '77777777777777777777777777777777777777777777',
                processingStatus: 'PROCESSED',
                rawXml: createValidNfeXml({
                  key: '77777777777777777777777777777777777777777777',
                  number: '777',
                  plate: 'RHV4H87',
                }),
              },
            },
          },
        ]),
      },
      vehicle: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'vehicle_1',
            plate: 'RHV4H87',
            brand: 'M BENZ',
            model: 'ACTROS 2651',
          },
        ]),
      },
    };

    const service = new XmlImportService(prisma as any);
    const result = await service.listRetailProductItems('company_1');

    expect(prisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company_1',
          plate: { in: ['RHV4H87'] },
        }),
      }),
    );
    expect(result[0].retailProductImport.vehicle).toEqual({
      id: 'vehicle_1',
      plate: 'RHV4H87',
      brand: 'M BENZ',
      model: 'ACTROS 2651',
    });
    expect(result[0].retailProductImport.sourcePlate).toBe('RHV4H87');
  });
});
