const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PDFParse } = require("pdf-parse");

const prisma = new PrismaClient();

function parseDecimal(value) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function toIsoDateTime(dateBr) {
  const [dd, mm, yyyy] = dateBr.split("/");
  return new Date(`${yyyy}-${mm}-${dd}T12:00:00.000Z`);
}

function sanitizeStation(value) {
  return value.replace(/\s+-\s*$/, "").trim();
}

function parseLine(line) {
  const withDriver =
    /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(\d+,\d{2})\s+(\d+,\d{3})\s+(\d{2}:\d{2}:\d{2})\s+(\d+)\s+([A-Za-zÀ-ÿ.\- ]+)\s+(\d+)\s+([A-Z0-9]{7})$/;
  const noDriver =
    /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(\d+,\d{2})\s+(\d+,\d{3})\s+(\d{2}:\d{2}:\d{2})\s+(\d+)\s+(\d+)\s+([A-Z0-9]{7})$/;
  const compactNoDriver =
    /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(\d+,\d{2})\s+(\d+,\d{3})\s+(\d{2}:\d{2}:\d{2})\s+(\d+)\s+([A-Z0-9]{7})$/;

  let m = line.match(withDriver);
  if (m) {
    return {
      fuelDate: toIsoDateTime(m[1]),
      station: sanitizeStation(m[2]),
      totalValue: parseDecimal(m[3]),
      liters: parseDecimal(m[4]),
      note: m[6],
      driverName: m[7].trim(),
      km: Number(m[8]),
      plate: m[9].trim(),
    };
  }

  m = line.match(noDriver);
  if (m) {
    return {
      fuelDate: toIsoDateTime(m[1]),
      station: sanitizeStation(m[2]),
      totalValue: parseDecimal(m[3]),
      liters: parseDecimal(m[4]),
      note: m[6],
      driverName: null,
      km: Number(m[7]),
      plate: m[8].trim(),
    };
  }

  m = line.match(compactNoDriver);
  if (m) {
    return {
      fuelDate: toIsoDateTime(m[1]),
      station: sanitizeStation(m[2]),
      totalValue: parseDecimal(m[3]),
      liters: parseDecimal(m[4]),
      note: null,
      driverName: null,
      km: Number(m[6]),
      plate: m[7].trim(),
    };
  }

  return null;
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function resolveFallbackBranch() {
  const matriz = await prisma.branch.findFirst({
    where: { name: { contains: "Pelanda 22", mode: "insensitive" } },
  });
  if (!matriz) {
    throw new Error("Filial Pelanda 22 nao encontrada para fallback de importacao.");
  }
  return matriz;
}

async function resolveBranchForStation(station) {
  const branches = await prisma.branch.findMany({
    select: { id: true, name: true },
  });

  const stationNorm = normalizeText(station);

  const direct = branches.find((branch) =>
    stationNorm.includes(normalizeText(branch.name))
  );
  if (direct) return direct;

  const tokenized = branches.find((branch) => {
    const bn = normalizeText(branch.name);
    const tokens = bn.split(" ").filter((t) => t.length >= 3);
    const hits = tokens.filter((t) => stationNorm.includes(t)).length;
    return hits >= 2;
  });
  if (tokenized) return tokenized;

  return resolveFallbackBranch();
}

async function ensureVehicleByPlate(plate, station) {
  const existing = await prisma.vehicle.findUnique({ where: { plate } });
  if (existing) return existing;

  const branch = await resolveBranchForStation(station);

  return prisma.vehicle.create({
    data: {
      plate,
      model: "Importado PDF",
      brand: "Nao informado",
      year: 2024,
      vehicleType: "HEAVY",
      branch: { connect: { id: branch.id } },
    },
  });
}

async function run() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    throw new Error("Informe o caminho do PDF. Ex: node scripts/import-fuel-frequency-report.js C:/arquivo.pdf");
  }

  const pdfPath = path.resolve(fileArg);
  const dataBuffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: dataBuffer });
  const result = await parser.getText();
  const text = result?.text || "";

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = lines.map(parseLine).filter(Boolean);

  let imported = 0;
  let skipped = 0;

  for (const row of parsed) {
    const vehicle = await ensureVehicleByPlate(row.plate, row.station);

    const alreadyExists = await prisma.fuelRecord.findFirst({
      where: {
        vehicleId: vehicle.id,
        fuelDate: row.fuelDate,
        liters: row.liters,
        totalValue: row.totalValue,
        km: row.km,
      },
    });

    if (alreadyExists) {
      skipped += 1;
      continue;
    }

    await prisma.fuelRecord.create({
      data: {
        vehicleId: vehicle.id,
        fuelDate: row.fuelDate,
        station: row.station,
        liters: row.liters,
        totalValue: row.totalValue,
        km: row.km,
      },
    });

    imported += 1;
  }

  console.log(
    JSON.stringify(
      {
        source: pdfPath,
        rowsDetected: parsed.length,
        imported,
        skipped,
      },
      null,
      2
    )
  );
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
