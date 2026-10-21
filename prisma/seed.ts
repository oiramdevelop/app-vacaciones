// Seed de DESARROLLO con datos ficticios. Borra y recrea usuarios, solicitudes, saldos y auditoría.
// La contraseña de todos los usuarios sale de SEED_PASSWORD (.env); nunca se escribe en el código.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type RequestStatus } from "../src/generated/prisma/client";

if (process.env.NODE_ENV === "production") {
  throw new Error("El seed de desarrollo no puede ejecutarse con NODE_ENV=production");
}
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 12) {
  throw new Error("Define SEED_PASSWORD (mínimo 12 caracteres) en .env");
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const utcDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const YEAR = 2026;
const ANNUAL_DAYS = 22;

// Todos los periodos son de lunes a viernes; `days` ya descuenta los festivos del seed.
interface SeedRequest {
  employee: string; // email
  start: string;
  end: string;
  days: number;
  status: RequestStatus;
  reason?: string;
  rejectionReason?: string;
  createdAt: string;
}

const EMPLOYEES = [
  { name: "Lucía Fernández", email: "lucia.fernandez@ejemplo.test", hireDate: "2021-03-01" },
  { name: "Javier Soto", email: "javier.soto@ejemplo.test", hireDate: "2022-09-12" },
  { name: "Diego Herrera", email: "diego.herrera@ejemplo.test", hireDate: "2020-01-15" },
  { name: "Marta Ruiz", email: "marta.ruiz@ejemplo.test", hireDate: "2019-06-03" },
  { name: "Pedro Navarro", email: "pedro.navarro@ejemplo.test", hireDate: "2023-02-20" },
  { name: "Sara Molina", email: "sara.molina@ejemplo.test", hireDate: "2018-11-05" },
  { name: "Elena Vidal", email: "elena.vidal@ejemplo.test", hireDate: "2022-04-18" },
  { name: "Ana Castillo", email: "ana.castillo@ejemplo.test", hireDate: "2024-01-08" },
];

const REQUESTS: SeedRequest[] = [
  { employee: "lucia.fernandez@ejemplo.test", start: "2026-08-03", end: "2026-08-07", days: 5, status: "APPROVED", createdAt: "2026-06-12" },
  { employee: "lucia.fernandez@ejemplo.test", start: "2026-12-21", end: "2026-12-31", days: 8, status: "APPROVED", createdAt: "2026-09-30" },
  { employee: "lucia.fernandez@ejemplo.test", start: "2026-11-16", end: "2026-11-20", days: 5, status: "PENDING", reason: "Viaje familiar", createdAt: "2026-10-05" },
  { employee: "lucia.fernandez@ejemplo.test", start: "2026-05-18", end: "2026-05-19", days: 2, status: "REJECTED", rejectionReason: "Cierre trimestral: no es posible ausentarse esas fechas.", createdAt: "2026-05-02" },
  { employee: "javier.soto@ejemplo.test", start: "2026-12-14", end: "2026-12-18", days: 5, status: "PENDING", createdAt: "2026-10-07" },
  { employee: "diego.herrera@ejemplo.test", start: "2026-09-07", end: "2026-09-11", days: 5, status: "APPROVED", createdAt: "2026-07-20" },
  { employee: "marta.ruiz@ejemplo.test", start: "2026-10-05", end: "2026-10-09", days: 5, status: "APPROVED", createdAt: "2026-08-25" },
  { employee: "pedro.navarro@ejemplo.test", start: "2026-11-02", end: "2026-11-06", days: 5, status: "PENDING", createdAt: "2026-10-06" },
  { employee: "sara.molina@ejemplo.test", start: "2026-07-20", end: "2026-07-31", days: 10, status: "APPROVED", createdAt: "2026-05-10" },
  { employee: "elena.vidal@ejemplo.test", start: "2026-10-13", end: "2026-10-16", days: 4, status: "APPROVED", createdAt: "2026-09-15" },
  { employee: "ana.castillo@ejemplo.test", start: "2026-11-23", end: "2026-11-27", days: 5, status: "REJECTED", rejectionReason: "Coincide con otra ausencia del equipo.", createdAt: "2026-10-01" },
];

async function main() {
  const passwordHash = await bcrypt.hash(password!, 12);

  await db.loginThrottle.deleteMany();
  await db.auditLog.deleteMany();
  await db.ledgerEntry.deleteMany();
  await db.vacationRequest.deleteMany();
  await db.user.deleteMany();

  let policy = await db.vacationPolicy.findFirst({ where: { isDefault: true } });
  policy ??= await db.vacationPolicy.create({
    data: {
      name: "Política general (ejemplo)",
      annualDays: ANNUAL_DAYS,
      calculationType: "WORKING_DAYS",
      workingWeekdays: [1, 2, 3, 4, 5],
      excludeHolidays: true,
      effectiveFrom: utcDate("2026-01-01"),
      isDefault: true,
    },
  });

  const holidays: [string, string][] = [
    ["2026-01-01", "Año Nuevo"], ["2026-01-06", "Reyes"], ["2026-05-01", "Día del Trabajo"],
    ["2026-08-15", "Asunción"], ["2026-10-12", "Fiesta Nacional"], ["2026-12-25", "Navidad"], ["2027-01-01", "Año Nuevo"],
  ];
  for (const [date, name] of holidays) {
    await db.holiday.upsert({
      where: { date_region: { date: utcDate(date), region: "" } },
      update: { name },
      create: { date: utcDate(date), name, region: "" },
    });
  }

  const admin = await db.user.create({
    data: {
      name: "Carlos Admin",
      email: "admin@ejemplo.test",
      passwordHash,
      role: "ADMIN",
      hireDate: utcDate("2017-01-09"),
    },
  });

  const users = new Map<string, string>();
  for (const e of EMPLOYEES) {
    const u = await db.user.create({
      data: {
        name: e.name,
        email: e.email,
        passwordHash,
        role: "EMPLOYEE",
        hireDate: utcDate(e.hireDate),
      },
    });
    users.set(e.email, u.id);
    await db.ledgerEntry.create({
      data: { employeeId: u.id, year: YEAR, type: "ALLOCATION", days: ANNUAL_DAYS, reason: "Asignación anual", createdById: admin.id },
    });
  }

  const snapshot = {
    policyId: policy.id,
    annualDays: policy.annualDays,
    calculationType: policy.calculationType,
    workingWeekdays: policy.workingWeekdays,
    excludeHolidays: policy.excludeHolidays,
  };

  for (const r of REQUESTS) {
    const employeeId = users.get(r.employee)!;
    const reviewed = r.status === "APPROVED" || r.status === "REJECTED";
    const request = await db.vacationRequest.create({
      data: {
        employeeId,
        startDate: utcDate(r.start),
        endDate: utcDate(r.end),
        totalDays: r.days,
        status: r.status,
        reason: r.reason,
        rejectionReason: r.rejectionReason,
        reviewedById: reviewed ? admin.id : null,
        reviewedAt: reviewed ? new Date(`${r.createdAt}T12:00:00.000Z`) : null,
        policyId: policy.id,
        policySnapshot: { ...snapshot, daysByYear: { [YEAR]: r.days } },
        createdAt: new Date(`${r.createdAt}T09:00:00.000Z`),
      },
    });
    if (r.status === "APPROVED") {
      await db.ledgerEntry.create({
        data: { employeeId, year: YEAR, type: "CONSUMPTION", days: -r.days, requestId: request.id, reason: "Solicitud aprobada", createdById: admin.id },
      });
    }
  }

  await db.ledgerEntry.create({
    data: {
      employeeId: users.get("diego.herrera@ejemplo.test")!,
      year: YEAR,
      type: "ADJUSTMENT",
      days: 2,
      reason: "Compensación por festivo trabajado",
      createdById: admin.id,
    },
  });

  console.log(`Seed completado: 1 admin, ${EMPLOYEES.length} empleados, ${REQUESTS.length} solicitudes.`);
}

main().finally(() => db.$disconnect());
