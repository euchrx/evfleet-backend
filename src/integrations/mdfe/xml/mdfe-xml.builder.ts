import { Injectable } from '@nestjs/common';

type BuildMdfeXmlInput = {
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
  };
};

@Injectable()
export class MdfeXmlBuilder {
  build(input: BuildMdfeXmlInput): string {
    const tpAmb = input.environment === 'PRODUCTION' ? '1' : '2';
    const dhEmi = input.issuedAt.toISOString();

    return `<?xml version="1.0" encoding="UTF-8"?>
<MDFe xmlns="http://www.portalfiscal.inf.br/mdfe">
  <infMDFe Id="${input.id}" versao="3.00">
    <ide>
      <cUF>${this.ufCode(input.fiscal.state)}</cUF>
      <tpAmb>${tpAmb}</tpAmb>
      <tpEmit>1</tpEmit>
      <mod>58</mod>
      <serie>${input.series}</serie>
      <nMDF>${input.number}</nMDF>
      <cMDF>${this.randomCode()}</cMDF>
      <cDV>0</cDV>
      <modal>1</modal>
      <dhEmi>${dhEmi}</dhEmi>
      <tpEmis>1</tpEmis>
      <procEmi>0</procEmi>
      <verProc>EvFleet-1.0</verProc>
      <UFIni>${input.route.originState}</UFIni>
      <UFFim>${input.route.destinationState}</UFFim>
      <infMunCarrega>
        <cMunCarrega>${input.route.originCityIbgeCode}</cMunCarrega>
        <xMunCarrega>${this.escape(input.route.originCityName)}</xMunCarrega>
      </infMunCarrega>
    </ide>

    <emit>
      <CNPJ>${this.onlyDigits(input.fiscal.cnpj)}</CNPJ>
      <IE>${this.onlyDigits(input.fiscal.stateRegistration || '')}</IE>
      <xNome>${this.escape(input.fiscal.corporateName)}</xNome>
      <enderEmit>
        <xLgr>${this.escape(input.fiscal.addressStreet)}</xLgr>
        <nro>${this.escape(input.fiscal.addressNumber)}</nro>
        <xBairro>${this.escape(input.fiscal.addressDistrict)}</xBairro>
        <cMun>${input.fiscal.cityIbgeCode}</cMun>
        <xMun>${this.escape(input.fiscal.cityName)}</xMun>
        <CEP>${this.onlyDigits(input.fiscal.zipCode)}</CEP>
        <UF>${input.fiscal.state}</UF>
      </enderEmit>
    </emit>

    <infModal versaoModal="3.00">
      <rodo>
        <veicTracao>
          <placa>${this.onlyPlate(input.vehicle.plate)}</placa>
          ${input.vehicle.renavam ? `<RENAVAM>${this.onlyDigits(input.vehicle.renavam)}</RENAVAM>` : ''}
          <condutor>
            <xNome>${this.escape(input.driver.name)}</xNome>
            <CPF>${this.onlyDigits(input.driver.cpf)}</CPF>
          </condutor>
        </veicTracao>
      </rodo>
    </infModal>
  </infMDFe>
</MDFe>`;
  }

  private onlyDigits(value: string): string {
    return String(value || '').replace(/\D/g, '');
  }

  private onlyPlate(value: string): string {
    return String(value || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  }

  private escape(value: string): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private randomCode(): string {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
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

    return map[uf.toUpperCase()] ?? '41';
  }
}