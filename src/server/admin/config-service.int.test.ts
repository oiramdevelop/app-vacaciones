import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { ForbiddenError } from "@/server/auth/errors";
import { getPolicyForDate } from "@/server/vacations/queries";
import { createPolicy, createUser, resetDb } from "../../../tests/helpers";
import { addHoliday, removeHoliday, savePolicyVersion } from "./config-service";

const policyInput = (over: Record<string, unknown> = {}) => ({
  name: "Nueva política",
  annualDays: 25,
  calculationType: "CALENDAR_DAYS",
  workingWeekdays: [1, 2, 3, 4, 5],
  excludeHolidays: false,
  allowFutureRequests: true,
  maxAdvanceDays: null,
  minNoticeDays: 0,
  requiresApproval: true,
  holidayRegion: "",
  effectiveFrom: "2027-01-01",
  ...over,
});

let admin: Awaited<ReturnType<typeof createUser>>["actor"];
let ana: Awaited<ReturnType<typeof createUser>>["actor"];

beforeEach(async () => {
  await resetDb();
  await createPolicy();
  admin = (await createUser("ADMIN", "Root")).actor;
  ana = (await createUser("EMPLOYEE", "Ana")).actor;
});

describe("savePolicyVersion", () => {
  it("crea una versión nueva sin modificar la anterior y la selecciona por fecha de entrada en vigor", async () => {
    const before = await db.vacationPolicy.findFirstOrThrow();
    expect((await savePolicyVersion(admin, policyInput())).ok).toBe(true);

    expect(await db.vacationPolicy.count()).toBe(2);
    const old = await db.vacationPolicy.findUniqueOrThrow({ where: { id: before.id } });
    expect(old.annualDays).toBe(22);
    expect(old.calculationType).toBe("WORKING_DAYS");

    expect((await getPolicyForDate(db, "2026-12-31")).rules.calculationType).toBe("WORKING_DAYS");
    expect((await getPolicyForDate(db, "2027-01-01")).rules.calculationType).toBe("CALENDAR_DAYS");
    expect(await db.auditLog.count({ where: { action: "policy.version_created" } })).toBe(1);
  });

  it("valida los campos", async () => {
    expect((await savePolicyVersion(admin, policyInput({ workingWeekdays: [] }))).ok).toBe(false);
    expect((await savePolicyVersion(admin, policyInput({ workingWeekdays: [1, 1] }))).ok).toBe(false);
    expect((await savePolicyVersion(admin, policyInput({ annualDays: -1 }))).ok).toBe(false);
    expect((await savePolicyVersion(admin, policyInput({ effectiveFrom: "2027-02-30" }))).ok).toBe(false);
    expect(await db.vacationPolicy.count()).toBe(1);
  });

  it("un empleado no puede cambiar la política", async () => {
    await expect(savePolicyVersion(ana, policyInput())).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.vacationPolicy.count()).toBe(1);
  });
});

describe("festivos", () => {
  it("añade, rechaza duplicados y elimina", async () => {
    expect((await addHoliday(admin, { date: "2026-12-25", name: "Navidad", region: "" })).ok).toBe(true);
    expect((await addHoliday(admin, { date: "2026-12-25", name: "Otra vez", region: "" })).ok).toBe(false);
    expect((await addHoliday(admin, { date: "2026-12-25", name: "Regional", region: "Norte" })).ok).toBe(true);

    const holiday = await db.holiday.findFirstOrThrow({ where: { region: "" } });
    expect((await removeHoliday(admin, holiday.id)).ok).toBe(true);
    expect(await db.holiday.count()).toBe(1);
    await expect(addHoliday(ana, { date: "2026-12-26", name: "X", region: "" })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
