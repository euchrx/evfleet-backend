export class MdfeTemplate {
  buildPayload(input: {
    trip: any;
    vehicle: any;
    driver: any;
    products: any[];
  }) {
    return {
      emitente: {
        companyId: input.trip.companyId ?? null,
      },
      veiculo: {
        placa: input.vehicle.plate,
        renavam: input.vehicle.renavam ?? null,
      },
      motorista: input.driver
        ? {
            nome: input.driver.name,
            cpf: input.driver.cpf,
          }
        : null,
      percurso: {
        origem: input.trip.origin,
        destino: input.trip.destination,
      },
      produtosPerigosos: input.products.map((item) => ({
        nome: item.dangerousProduct.name,
        unNumber: item.dangerousProduct.unNumber,
        classeRisco: item.dangerousProduct.riskClass,
        quantidade: item.quantity.toString(),
        unidade: item.unit,
      })),
      mock: true,
      generatedAt: new Date().toISOString(),
    };
  }
}