export class EmergencySheetTemplate {
  render(input: {
    trip: any;
    company?: any;
    vehicle: any;
    driver: any;
    products: any[];
  }) {
    const companyName = input.company?.name ?? 'Empresa não informada';
    const companyCnpj = input.company?.cnpj ?? input.company?.document ?? '-';
    const companyPhone = input.company?.phone ?? '-';

    const productsHtml = input.products
      .map((item) => {
        const product = item.dangerousProduct;

        return `
          <div class="product-card">
            <div class="product-header">
              <div>
                <h3>${product.name}</h3>
                <p>${product.commercialName ?? 'Produto perigoso transportado'}</p>
              </div>

              <div class="risk-box">
                <strong>ONU ${product.unNumber}</strong>
                <span>Classe ${product.riskClass}</span>
              </div>
            </div>

            <table>
              <tbody>
                <tr>
                  <th>Número ONU</th>
                  <td>UN ${product.unNumber}</td>
                  <th>Classe de risco</th>
                  <td>${product.riskClass}</td>
                </tr>
                <tr>
                  <th>Grupo de embalagem</th>
                  <td>${product.packingGroup ?? '-'}</td>
                  <th>Nº de risco</th>
                  <td>${product.hazardNumber ?? '-'}</td>
                </tr>
                <tr>
                  <th>Estado físico</th>
                  <td>${product.physicalState ?? '-'}</td>
                  <th>Quantidade</th>
                  <td>${item.quantity} ${item.unit}</td>
                </tr>
                <tr>
                  <th>FISPQ</th>
                  <td colspan="3">${product.fispqUrl ?? 'Não informada'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      })
      .join('');

    return `
      <html>
        <head>
          <title>Ficha de Emergência</title>
          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 24px;
              font-family: Arial, Helvetica, sans-serif;
              color: #111827;
              background: #ffffff;
              font-size: 12px;
            }

            .page {
              width: 100%;
              max-width: 960px;
              margin: 0 auto;
              border: 2px solid #111827;
              padding: 18px;
            }

            .header {
              display: flex;
              justify-content: space-between;
              gap: 16px;
              border-bottom: 2px solid #111827;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }

            .header h1 {
              margin: 0;
              font-size: 24px;
              letter-spacing: 0.04em;
              text-transform: uppercase;
            }

            .header p {
              margin: 3px 0;
            }

            .tag {
              border: 2px solid #111827;
              padding: 8px 12px;
              text-align: center;
              font-weight: 700;
              text-transform: uppercase;
            }

            h2 {
              margin: 18px 0 8px;
              padding: 6px 8px;
              background: #f1f5f9;
              border: 1px solid #94a3b8;
              font-size: 14px;
              text-transform: uppercase;
            }

            h3 {
              margin: 0;
              font-size: 15px;
            }

            p {
              margin: 3px 0;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
            }

            th,
            td {
              border: 1px solid #94a3b8;
              padding: 6px;
              text-align: left;
              vertical-align: top;
            }

            th {
              width: 18%;
              background: #f8fafc;
              font-weight: 700;
            }

            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
            }

            .box {
              border: 1px solid #94a3b8;
              padding: 10px;
              min-height: 72px;
            }

            .product-card {
              border: 1px solid #94a3b8;
              padding: 10px;
              margin-bottom: 10px;
            }

            .product-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 12px;
              margin-bottom: 8px;
            }

            .risk-box {
              min-width: 120px;
              border: 2px solid #111827;
              padding: 8px;
              text-align: center;
            }

            .risk-box strong {
              display: block;
              font-size: 14px;
            }

            .risk-box span {
              display: block;
              margin-top: 2px;
              font-size: 12px;
            }

            ul {
              margin: 6px 0 0;
              padding-left: 18px;
            }

            li {
              margin-bottom: 4px;
            }

            .footer {
              margin-top: 18px;
              padding-top: 10px;
              border-top: 1px solid #94a3b8;
              font-size: 10px;
              color: #475569;
            }

            @media print {
              body {
                padding: 0;
              }

              .page {
                border: 2px solid #111827;
                max-width: none;
                min-height: 100vh;
              }
            }
          </style>
        </head>

        <body>
          <div class="page">
            <div class="header">
              <div>
                <h1>Ficha de Emergência</h1>
                <p><strong>Empresa:</strong> ${companyName}</p>
                <p><strong>CNPJ:</strong> ${companyCnpj}</p>
                <p><strong>Telefone:</strong> ${companyPhone}</p>
              </div>

              <div class="tag">
                Transporte<br />
                Produto perigoso
              </div>
            </div>

            <h2>1. Identificação do transporte</h2>

            <div class="grid">
              <div class="box">
                <p><strong>Origem:</strong> ${input.trip.origin}</p>
                <p><strong>Destino:</strong> ${input.trip.destination}</p>
                <p><strong>Data de saída:</strong> ${
                  input.trip.departureAt
                    ? new Date(input.trip.departureAt).toLocaleDateString('pt-BR')
                    : '-'
                }</p>
              </div>

              <div class="box">
                <p><strong>Veículo:</strong> ${input.vehicle?.plate ?? '-'}</p>
                <p><strong>Marca/Modelo:</strong> ${
                  [input.vehicle?.brand, input.vehicle?.model]
                    .filter(Boolean)
                    .join(' ') || '-'
                }</p>
                <p><strong>Motorista:</strong> ${input.driver?.name ?? '-'}</p>
              </div>
            </div>

            <h2>2. Produto(s) transportado(s)</h2>

            ${productsHtml}

            <h2>3. Riscos principais</h2>

            <div class="box">
              <ul>
                <li>Produto inflamável. Manter afastado de fontes de ignição, calor, faíscas e chamas.</li>
                <li>Vapores podem formar misturas explosivas com o ar.</li>
                <li>Evitar contato direto com pele, olhos e roupas.</li>
                <li>Evitar contaminação de solo, rede pluvial, rios e áreas de drenagem.</li>
              </ul>
            </div>

            <h2>4. Procedimentos em caso de emergência</h2>

            <div class="grid">
              <div class="box">
                <p><strong>Vazamento ou derramamento</strong></p>
                <ul>
                  <li>Isolar e sinalizar imediatamente a área.</li>
                  <li>Eliminar fontes de ignição.</li>
                  <li>Conter o vazamento com material absorvente adequado.</li>
                  <li>Não direcionar o produto para redes de esgoto ou drenagem.</li>
                </ul>
              </div>

              <div class="box">
                <p><strong>Incêndio</strong></p>
                <ul>
                  <li>Usar extintor de pó químico, CO₂ ou espuma adequada.</li>
                  <li>Resfriar recipientes expostos ao fogo com água neblinada.</li>
                  <li>Não utilizar jato de água diretamente sobre o produto.</li>
                </ul>
              </div>
            </div>

            <h2>5. EPI recomendado</h2>

            <div class="box">
              <ul>
                <li>Luvas resistentes a produtos químicos.</li>
                <li>Óculos de segurança ou protetor facial.</li>
                <li>Calçado de segurança.</li>
                <li>Roupa de proteção adequada para atendimento emergencial.</li>
              </ul>
            </div>

            <h2>6. Orientações ao condutor</h2>

            <div class="box">
              <ul>
                <li>Manter esta ficha acessível durante todo o transporte.</li>
                <li>Em caso de emergência, parar em local seguro e acionar os responsáveis.</li>
                <li>Não abandonar o veículo sem sinalizar e isolar a área.</li>
                <li>Consultar a FISPQ do produto para informações complementares.</li>
              </ul>
            </div>

            <div class="footer">
              Documento gerado automaticamente pelo sistema. As informações devem ser conferidas pela operação responsável antes do transporte.
            </div>
          </div>
        </body>
      </html>
    `;
  }
}