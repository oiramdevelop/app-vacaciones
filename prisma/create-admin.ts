// Crea el primer administrador (y una política por defecto si no existe). Válido para producción.
//   ADMIN_EMAIL=... ADMIN_NAME="..." ADMIN_PASSWORD=... npm run admin:create
// La contraseña se pasa por variable de entorno (no por argumento) para no quedar en el historial del shell.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.ADMIN_NAME?.trim();
const password = process.env.ADMIN_PASSWORD;
if (!email || !name || !password) throw new Error("Define ADMIN_EMAIL, ADMIN_NAME y ADMIN_PASSWORD");
if (password.length < 12) throw new Error("ADMIN_PASSWORD debe tener al menos 12 caracteres");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  if (await db.user.findUnique({ where: { email } })) throw new Error(`Ya existe un usuario con el email ${email}`);

  const admin = await db.user.create({
    data: { name: name!, email: email!, role: "ADMIN", hireDate: new Date(), passwordHash: await bcrypt.hash(password!, 12) },
  });
  await db.auditLog.create({ data: { actorId: admin.id, action: "employee.created", entityType: "User", entityId: admin.id, metadata: { email, role: "ADMIN", via: "create-admin script" } } });

  if ((await db.vacationPolicy.count()) === 0) {
    const year = new Date().getUTCFullYear();
    await db.vacationPolicy.create({
      data: { name: "Política general", annualDays: 22, effectiveFrom: new Date(Date.UTC(year, 0, 1)), isDefault: true },
    });
    console.log("Política por defecto creada (22 días laborables). Revísala en Configuración.");
  }
  console.log(`Administrador ${email} creado.`);
}

main().finally(() => db.$disconnect());
