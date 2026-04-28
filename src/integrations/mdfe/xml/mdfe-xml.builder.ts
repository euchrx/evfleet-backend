import { Injectable } from '@nestjs/common';

export type MdfeTrailerInput = {
  plate: string;
  renavam?: string | null;
  uf?: string | null;
  tara?: number | null;
  capKG?: number | null;
  capM3?: number | null;
};

export type MdfeDocumentInput = {
  type: 'CTE' | 'NFE';
  accessKey: string;
};

export type MdfeInsuranceInput = {
  responsibleDocument: string;
  responsibleName?: string | null;
  insurerName: string;
  insurerDocument: string;
  policyNumber: string;
  endorsementNumber?: string | null;
};

export type MdfePaymentInput = {
  contractorName: string;
  contractorDocument: string;
  componentType?: string | null;
  componentDescription?: string | null;
  componentValue: number;
  contractValue: number;
  paymentIndicator?: '0' | '1';
  pixKey?: string | null;
};

export type BuildMdfeXmlInput = {
  id: string;
  environment: 'HOMOLOGATION' | 'PRODUCTION';
  series: number;
  number: number;
  issuedAt: Date;
  fiscal: {
    cnpj: string;
    corporateName: string;
    stateRegistration?: string | null;
    cityIbgeCode: string;
    cityName: string;
    state: string;
    addressStreet: string;
    addressNumber: string;
    addressDistrict: string;
    zipCode: string;
  };
  vehicle: {
    plate: string;
    renavam?: string | null;
    uf?: string | null;
    tara?: number | null;
    reboques?: MdfeTrailerInput[];
  };
  driver: {
    cpf: string;
    name: string;
  };
  route: {
    originState: string;
    destinationState: string;
    originCityIbgeCode: string;
    destinationCityIbgeCode: string;
    originCityName: string;
    destinationCityName: string;
    originZipCode?: string | null;
    destinationZipCode?: string | null;
  };
  antt: {
    rntrc: string;
  };
  documents: MdfeDocumentInput[];
  insurance?: MdfeInsuranceInput | null;
  payment?: MdfePaymentInput | null;
  cargo: {
    productDescription: string;
    cargoType?: string | null;
    ncm?: string | null;
    totalValue: number;
    unitCode?: string | null;
    quantity: number;
  };
  additionalInfo?: string | null;
};

@Injectable()
export class MdfeXmlBuilder {
  build(input: BuildMdfeXmlInput): string {
    const tpAmb = input.environment === 'PRODUCTION' ? '1' : '2';
    const dhEmi = this.formatSefazDate(input.issuedAt);
    const accessKey = input.id.replace(/^MDFe/i, '');
    const cMDF = accessKey.slice(35, 43);
    const cDV = accessKey.slice(43, 44);
    const qrCodeUrl = `https://dfe-portal.svrs.rs.gov.br/mdfe/qrCode?chMDFe=${accessKey}&tpAmb=${tpAmb}`;

    const fiscalCnpj = this.onlyDigits(input.fiscal.cnpj);
    const fiscalName = this.escape(input.fiscal.corporateName);

    const reboquesXml = this.buildReboquesXml(
      input.vehicle.reboques || [],
      input.fiscal.state,
    );

    const anttXml = this.buildAnttXml(input, fiscalCnpj, fiscalName);
    const documentsXml = this.buildDocumentsXml(input.documents);
    const insuranceXml = this.buildInsuranceXml(input.insurance);
    const prodPredXml = this.buildProdPredXml(input);
    const totalsXml = this.buildTotalsXml(input);

    const additionalInfo = this.escape(
      input.additionalInfo ||
      (input.environment === 'HOMOLOGATION'
        ? 'Emitido em ambiente de homologacao pelo EvFleet.'
        : 'Emitido pelo EvFleet.'),
    );

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<MDFe xmlns="http://www.portalfiscal.inf.br/mdfe">
  <infMDFe Id="${input.id}" versao="3.00">
    <ide>
      <cUF>${this.ufCode(input.fiscal.state)}</cUF>
      <tpAmb>${tpAmb}</tpAmb>
      <tpEmit>1</tpEmit>
      <mod>58</mod>
      <serie>${input.series}</serie>
      <nMDF>${input.number}</nMDF>
      <cMDF>${cMDF}</cMDF>
      <cDV>${cDV}</cDV>
      <modal>1</modal>
      <dhEmi>${dhEmi}</dhEmi>
      <tpEmis>1</tpEmis>
      <procEmi>0</procEmi>
      <verProc>EvFleet-1.0</verProc>
      <UFIni>${this.uf(input.route.originState)}</UFIni>
      <UFFim>${this.uf(input.route.destinationState)}</UFFim>
      <infMunCarrega>
        <cMunCarrega>${this.onlyDigits(input.route.originCityIbgeCode)}</cMunCarrega>
        <xMunCarrega>${this.escape(input.route.originCityName)}</xMunCarrega>
      </infMunCarrega>
    </ide>

    <emit>
      <CNPJ>${fiscalCnpj}</CNPJ>
      <IE>${this.onlyDigits(input.fiscal.stateRegistration || '')}</IE>
      <xNome>${fiscalName}</xNome>
      <enderEmit>
        <xLgr>${this.escape(input.fiscal.addressStreet)}</xLgr>
        <nro>${this.escape(input.fiscal.addressNumber)}</nro>
        <xBairro>${this.escape(input.fiscal.addressDistrict)}</xBairro>
        <cMun>${this.onlyDigits(input.fiscal.cityIbgeCode)}</cMun>
        <xMun>${this.escape(input.fiscal.cityName)}</xMun>
        <CEP>${this.onlyDigits(input.fiscal.zipCode)}</CEP>
        <UF>${this.uf(input.fiscal.state)}</UF>
      </enderEmit>
    </emit>

    <infModal versaoModal="3.00">
      <rodo>
        ${anttXml}
        <veicTracao>
          <placa>${this.onlyPlate(input.vehicle.plate)}</placa>
          ${input.vehicle.renavam
        ? `<RENAVAM>${this.onlyDigits(input.vehicle.renavam)}</RENAVAM>`
        : ''
      }
          <tara>${this.positiveInt(input.vehicle.tara, 1)}</tara>
          <condutor>
            <xNome>${this.escape(input.driver.name)}</xNome>
            <CPF>${this.onlyDigits(input.driver.cpf)}</CPF>
          </condutor>
          <tpRod>03</tpRod>
          <tpCar>03</tpCar>
          <UF>${this.uf(input.vehicle.uf || input.fiscal.state)}</UF>
        </veicTracao>
        ${reboquesXml}
      </rodo>
    </infModal>

    <infDoc>
      <infMunDescarga>
        <cMunDescarga>${this.onlyDigits(input.route.destinationCityIbgeCode)}</cMunDescarga>
        <xMunDescarga>${this.escape(input.route.destinationCityName)}</xMunDescarga>
        ${documentsXml}
      </infMunDescarga>
    </infDoc>

    ${insuranceXml}

    ${prodPredXml}

    ${totalsXml}

    <infAdic>
      <infCpl>${additionalInfo}</infCpl>
    </infAdic>
  </infMDFe>

  <infMDFeSupl>
    <qrCodMDFe>${this.escape(qrCodeUrl)}</qrCodMDFe>
  </infMDFeSupl>
</MDFe>`;

    return this.cleanXmlBeforeSign(xml);
  }

  private buildAnttXml(
    input: BuildMdfeXmlInput,
    fiscalCnpj: string,
    fiscalName: string,
  ): string {
    const rntrc = this.onlyDigits(input.antt.rntrc);

    const contractorName = this.escape(
      input.payment?.contractorName || input.fiscal.corporateName,
    );

    const contractorDocument = this.onlyDigits(
      input.payment?.contractorDocument || input.fiscal.cnpj,
    );

    const contractorTag = contractorDocument.length === 11 ? 'CPF' : 'CNPJ';

    const componentType = this.onlyDigits(input.payment?.componentType || '99');

    const componentValue = this.money(
      input.payment?.componentValue || input.payment?.contractValue || 1,
    );

    const contractValue = this.money(
      input.payment?.contractValue || input.payment?.componentValue || 1,
    );

    const componentDescription = this.escape(
      input.payment?.componentDescription || 'Frete',
    );

    const pixKey = this.escape(input.payment?.pixKey || input.fiscal.cnpj);

    return `<infANTT><RNTRC>${rntrc}</RNTRC><infContratante><xNome>${contractorName}</xNome><${contractorTag}>${contractorDocument}</${contractorTag}></infContratante><infPag><xNome>${contractorName}</xNome><${contractorTag}>${contractorDocument}</${contractorTag}><Comp><tpComp>${componentType}</tpComp><vComp>${componentValue}</vComp><xComp>${componentDescription}</xComp></Comp><vContrato>${contractValue}</vContrato><indPag>0</indPag><infBanc><PIX>${pixKey}</PIX></infBanc></infPag></infANTT>`;
  }

  private buildDocumentsXml(documents: MdfeDocumentInput[]): string {
    return documents
      .map((document) => {
        const accessKey = this.onlyDigits(document.accessKey);

        if (document.type === 'CTE') {
          return `<infCTe><chCTe>${accessKey}</chCTe></infCTe>`;
        }

        return `<infNFe><chNFe>${accessKey}</chNFe></infNFe>`;
      })
      .join('');
  }

  private buildInsuranceXml(insurance?: MdfeInsuranceInput | null): string {
    if (!insurance) {
      return '';
    }

    const responsibleDocument = this.onlyDigits(insurance.responsibleDocument);
    const responsibleTag = responsibleDocument.length === 11 ? 'CPF' : 'CNPJ';
    const insurerDocument = this.onlyDigits(insurance.insurerDocument);
    const insurerTag = insurerDocument.length === 11 ? 'CPF' : 'CNPJ';

    const endorsement = insurance.endorsementNumber
      ? `<nAver>${this.escape(insurance.endorsementNumber)}</nAver>`
      : '';

    return `<seg><infResp><respSeg>1</respSeg><${responsibleTag}>${responsibleDocument}</${responsibleTag}></infResp><infSeg><xSeg>${this.escape(insurance.insurerName)}</xSeg><${insurerTag}>${insurerDocument}</${insurerTag}></infSeg><nApol>${this.escape(insurance.policyNumber)}</nApol>${endorsement}</seg>`;
  }

  private buildProdPredXml(input: BuildMdfeXmlInput): string {
    const cargoType = input.cargo.cargoType || '08';
    const ncm = `<NCM>${this.onlyDigits(input.cargo.ncm || '27101932')}</NCM>`;

    const originCep = this.onlyDigits(
      input.route.originZipCode || input.fiscal.zipCode,
    );
    const destinationCep = this.onlyDigits(
      input.route.destinationZipCode || input.fiscal.zipCode,
    );

    return `<prodPred><tpCarga>${this.escape(cargoType)}</tpCarga><xProd>${this.escape(input.cargo.productDescription)}</xProd>${ncm}<infLotacao><infLocalCarrega><CEP>${originCep}</CEP></infLocalCarrega><infLocalDescarrega><CEP>${destinationCep}</CEP></infLocalDescarrega></infLotacao></prodPred>`;
  }

  private buildTotalsXml(input: BuildMdfeXmlInput): string {
    const qCTe = input.documents.filter(
      (document) => document.type === 'CTE',
    ).length;

    const qNFe = input.documents.filter(
      (document) => document.type === 'NFE',
    ).length;

    const qCTeXml = qCTe > 0 ? `<qCTe>${qCTe}</qCTe>` : '';
    const qNFeXml = qNFe > 0 ? `<qNFe>${qNFe}</qNFe>` : '';

    return `<tot>${qCTeXml}${qNFeXml}<vCarga>${this.money(input.cargo.totalValue)}</vCarga><cUnid>${this.escape(input.cargo.unitCode || '01')}</cUnid><qCarga>${this.quantity(input.cargo.quantity)}</qCarga></tot>`;
  }

  private buildReboquesXml(
    reboques: MdfeTrailerInput[],
    defaultUf: string,
  ): string {
    return reboques
      .filter((reboque) => this.onlyPlate(reboque.plate))
      .map((reboque) => {
        const renavam = reboque.renavam
          ? `<RENAVAM>${this.onlyDigits(reboque.renavam)}</RENAVAM>`
          : '';

        const capKG =
          reboque.capKG && reboque.capKG > 0
            ? Math.trunc(reboque.capKG)
            : 30000;

        const capM3 =
          reboque.capM3 && reboque.capM3 > 0
            ? `<capM3>${Math.trunc(reboque.capM3)}</capM3>`
            : '';

        return `<veicReboque><placa>${this.onlyPlate(
          reboque.plate,
        )}</placa>${renavam}<tara>${Math.trunc(
          reboque.tara || 8000,
        )}</tara><capKG>${capKG}</capKG>${capM3}<tpCar>03</tpCar></veicReboque>`;
      })
      .join('');
  }

  private cleanXmlBeforeSign(xml: string): string {
    return String(xml || '')
      .replace(/^\uFEFF/, '')
      .replace(/\r/g, '')
      .replace(/\n/g, '')
      .replace(/\t/g, '')
      .replace(/>\s+</g, '><')
      .trim();
  }

  private formatSefazDate(date: Date): string {
    const d = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}-03:00`;
  }

  private onlyDigits(value: string | number | null | undefined): string {
    return String(value || '').replace(/\D/g, '');
  }

  private onlyPlate(value: string | null | undefined): string {
    return String(value || '')
      .replace(/[^A-Z0-9]/gi, '')
      .toUpperCase();
  }

  private escape(value: string | number | null | undefined): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private money(value: number): string {
    return Number(value || 0).toFixed(2);
  }

  private quantity(value: number): string {
    return Number(value || 0).toFixed(4);
  }

  private positiveInt(value: number | null | undefined, fallback: number): number {
    const parsed = Math.trunc(Number(value || 0));
    return parsed > 0 ? parsed : fallback;
  }

  private uf(value: string): string {
    return String(value || '').trim().toUpperCase().slice(0, 2);
  }

  private ufCode(uf: string): string {
    const map: Record<string, string> = {
      RO: '11',
      AC: '12',
      AM: '13',
      RR: '14',
      PA: '15',
      AP: '16',
      TO: '17',
      MA: '21',
      PI: '22',
      CE: '23',
      RN: '24',
      PB: '25',
      PE: '26',
      AL: '27',
      SE: '28',
      BA: '29',
      MG: '31',
      ES: '32',
      RJ: '33',
      SP: '35',
      PR: '41',
      SC: '42',
      RS: '43',
      MS: '50',
      MT: '51',
      GO: '52',
      DF: '53',
    };

    return map[this.uf(uf)] ?? '41';
  }
}