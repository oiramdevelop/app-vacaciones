import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { ForbiddenError } from "@/server/auth/errors";
import { verifyPassword } from "@/server/auth/password";
import { getYearBalances } from "@/server/vacations/queries";
import { createPolicy, createUser, ledgerSum, resetDb, TODAY, YEAR } from "../../../tests/helpers";
import { adjustBalance, allocateAnnualDays, createEmployee, setEmployeeActive, updateEmployee } from "./employee-service";

const newEmployee = (over: Record<string, unknown> = {}) => ({
  name: "Nuevo Empleado",
  email: "Nuevo@Test.Local",
  company: "GALACTICBLUM",
  departmentId: "",
  hireDate: "2026-10-01",
  role: "EMPLOYEE",
  password: "una-contraseña-larga",
  initialDays: 22,
  ...over,
});

let admin: Awaited<ReturnType<typeof createUser>>["actor"];
let ana: Awaited<ReturnType<typeof createUser>>["actor"];

beforeEach(async () => {
  await resetDb();
  await createPolicy();
  admin = (await createUser("ADMIN", "Root")).actor;
  ana = (await createUser("EMPLOYEE", "Ana", { allocate: 22 })).actor;
});

describe("createEmployee", () => {
  it("crea el empleado con hash, asignación inicial y auditoría sin la contraseña", async () => {
    const result = await createEmployee(admin, newEmployee(), TODAY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const user = await db.user.findUniqueOrThrow({ where: { id: result.id } });
    expect(user.email).toBe("nuevo@test.local"); // normalizado
    expect(user.company).toBe("GALACTICBLUM");
    expect(user.passwordHash).not.toContain("una-contraseña");
    expect(await verifyPassword("una-contraseña-larga", user.passwordHash)).toBe(true);
    expect(await ledgerSum(user.id)).toBe(22);

    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "employee.created", entityId: user.id } });
    expect(JSON.stringify(audit.metadata)).not.toContain("una-contraseña");
  });

  it("rechaza email duplicado (sin distinguir mayúsculas), contraseña corta y departamento inexistente", async () => {
    await createEmployee(admin, newEmployee(), TODAY);
    expect((await createEmployee(admin, newEmployee({ email: "NUEVO@test.local" }), TODAY)).ok).toBe(false);
    expect((await createEmployee(admin, newEmployee({ email: "otro@test.local", password: "corta" }), TODAY)).ok).toBe(false);
    expect((await createEmployee(admin, newEmployee({ email: "otro@test.local", departmentId: "no-existe" }), TODAY)).ok).toBe(false);
    expect((await createEmployee(admin, newEmployee({ email: "otro@test.local", company: "OTRA" }), TODAY)).ok).toBe(false);
    expect(await db.user.count({ where: { email: { startsWith: "otro" } } })).toBe(0);
  });

  it("un empleado no puede crear empleados", async () => {
    await expect(createEmployee(ana, newEmployee(), TODAY)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.user.count()).toBe(2);
  });
});

describe("updateEmployee / setEmployeeActive", () => {
  const edit = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    name: "Ana García",
    email: "ana@test.local",
    company: "FLORAMARKET",
    departmentId: "",
    hireDate: "2020-01-01",
    role: "EMPLOYEE",
    newPassword: "",
    ...over,
  });

  it("edita datos y cambia la contraseña sólo si se indica", async () => {
    const before = (await db.user.findUniqueOrThrow({ where: { id: ana.id } })).passwordHash;
    expect((await updateEmployee(admin, edit(ana.id, { company: "GALACTICBLUM" }))).ok).toBe(true);
    const after = await db.user.findUniqueOrThrow({ where: { id: ana.id } });
    expect(after.name).toBe("Ana García");
    expect(after.company).toBe("GALACTICBLUM");
    expect(after.passwordHash).toBe(before);

    expect((await updateEmployee(admin, edit(ana.id, { newPassword: "nueva-contraseña-1" }))).ok).toBe(true);
    const reset = await db.user.findUniqueOrThrow({ where: { id: ana.id } });
    expect(await verifyPassword("nueva-contraseña-1", reset.passwordHash)).toBe(true);
  });

  it("no permite quitarse el rol de admin ni dejar la app sin administradores", async () => {
    expect((await updateEmployee(admin, edit(admin.id, { email: admin.email, role: "EMPLOYEE" }))).ok).toBe(false);
    expect((await setEmployeeActive(admin, admin.id, false)).ok).toBe(false);

    // Con otro admin activo, un admin sí puede desactivar al otro, pero no al último.
    const { actor: second } = await createUser("ADMIN", "Segundo");
    expect((await setEmployeeActive(admin, second.id, false)).ok).toBe(true);
    expect((await setEmployeeActive(admin, second.id, true)).ok).toBe(true);
    expect((await setEmployeeActive(second, admin.id, false)).ok).toBe(true);
    expect((await setEmployeeActive(admin, second.id, false)).ok).toBe(false);
  });

  it("desactivar y reactivar queda en la auditoría", async () => {
    await setEmployeeActive(admin, ana.id, false);
    expect((await db.user.findUniqueOrThrow({ where: { id: ana.id } })).isActive).toBe(false);
    await setEmployeeActive(admin, ana.id, true);
    expect(await db.auditLog.count({ where: { entityId: ana.id, action: { in: ["employee.deactivated", "employee.activated"] } } })).toBe(2);
  });

  it("un empleado no puede editar ni desactivar a nadie", async () => {
    await expect(updateEmployee(ana, edit(admin.id))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setEmployeeActive(ana, admin.id, false)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).isActive).toBe(true);
  });
});

describe("adjustBalance", () => {
  it("suma y resta quedando registrado en el libro y la auditoría", async () => {
    expect((await adjustBalance(admin, { employeeId: ana.id, year: YEAR, days: 3, reason: "Compensación" }, TODAY)).ok).toBe(true);
    expect((await adjustBalance(admin, { employeeId: ana.id, year: YEAR, days: -2, reason: "Corrección" }, TODAY)).ok).toBe(true);
    expect(await ledgerSum(ana.id)).toBe(23);
    expect(await db.ledgerEntry.count({ where: { employeeId: ana.id, type: "ADJUSTMENT", createdById: admin.id } })).toBe(2);
    expect(await db.auditLog.count({ where: { action: "balance.adjusted" } })).toBe(2);
  });

  it("no deja el saldo disponible en negativo, ni acepta 0 o decimales", async () => {
    expect((await adjustBalance(admin, { employeeId: ana.id, year: YEAR, days: -23, reason: "Demasiado" }, TODAY)).ok).toBe(false);
    expect((await adjustBalance(admin, { employeeId: ana.id, year: YEAR, days: 0, reason: "Nada" }, TODAY)).ok).toBe(false);
    expect((await adjustBalance(admin, { employeeId: ana.id, year: YEAR, days: 1.5, reason: "Medio" }, TODAY)).ok).toBe(false);
    expect((await adjustBalance(admin, { employeeId: ana.id, year: YEAR, days: 2, reason: "" }, TODAY)).ok).toBe(false);
    expect(await ledgerSum(ana.id)).toBe(22);
  });

  it("una resta no puede invadir los días ya reservados por solicitudes pendientes", async () => {
    const policy = await db.vacationPolicy.findFirstOrThrow();
    await db.vacationRequest.create({
      data: {
        employeeId: ana.id,
        startDate: new Date("2026-11-02T00:00:00Z"),
        endDate: new Date("2026-11-13T00:00:00Z"),
        totalDays: 10,
        policyId: policy.id,
        policySnapshot: { daysByYear: { "2026": 10 } },
      },
    });
    const [b] = await getYearBalances(db, ana.id, [YEAR], TODAY);
    expect(b!.available).toBe(12);
    expect((await adjustBalance(admin, { employeeId: ana.id, year: YEAR, days: -13, reason: "Exceso" }, TODAY)).ok).toBe(false);
    expect((await adjustBalance(admin, { employeeId: ana.id, year: YEAR, days: -12, reason: "Justo" }, TODAY)).ok).toBe(true);
  });

  it("un empleado no puede ajustar saldos, ni siquiera el suyo", async () => {
    await expect(adjustBalance(ana, { employeeId: ana.id, year: YEAR, days: 10, reason: "Yo mismo" }, TODAY)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await ledgerSum(ana.id)).toBe(22);
  });
});

describe("allocateAnnualDays", () => {
  it("asigna a los activos sin asignación y es idempotente", async () => {
    const { user: luis } = await createUser("EMPLOYEE", "Luis");
    const { user: inactive } = await createUser("EMPLOYEE", "Inactivo");
    await db.user.update({ where: { id: inactive.id }, data: { isActive: false } });

    const first = await allocateAnnualDays(admin, 2027);
    expect(first).toMatchObject({ ok: true, created: 2 }); // Ana y Luis; no el admin ni el inactivo
    expect(await ledgerSum(luis.id, 2027)).toBe(22);
    expect(await ledgerSum(inactive.id, 2027)).toBe(0);

    expect(await allocateAnnualDays(admin, 2027)).toMatchObject({ ok: true, created: 0 });
    expect(await ledgerSum(luis.id, 2027)).toBe(22);
  });

  it("sólo un administrador puede ejecutarla", async () => {
    await expect(allocateAnnualDays(ana, 2027)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
