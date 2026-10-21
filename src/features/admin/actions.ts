"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { assertRole } from "@/server/auth/session";
import { approveRequest, cancelApprovedRequest, rejectRequest } from "@/server/admin/review-service";
import { adjustBalance, allocateAnnualDays, createEmployee, setEmployeeActive, updateEmployee } from "@/server/admin/employee-service";
import { addHoliday, removeHoliday, savePolicyVersion } from "@/server/admin/config-service";
import { rejectSchema, type AdjustBalanceInput, type EmployeeCreateInput, type EmployeeUpdateInput, type HolidayInput, type PolicyInput } from "./schemas";

/** Ejecuta un servicio como administrador y refresca las pantallas afectadas si tuvo éxito. */
async function run<T extends ActionResult>(paths: string[], fn: (actor: Awaited<ReturnType<typeof assertRole>>) => Promise<T>): Promise<T> {
  const actor = await assertRole("ADMIN");
  const result = await fn(actor);
  if (result.ok) for (const p of paths) revalidatePath(p);
  return result;
}

const REQUEST_PATHS = ["/admin", "/admin/solicitudes", "/admin/empleados", "/admin/calendario", "/admin/historial", "/dashboard", "/calendario"];
const EMPLOYEE_PATHS = ["/admin", "/admin/empleados", "/admin/historial"];
const CONFIG_PATHS = ["/admin/configuracion", "/admin/empleados", "/admin/historial"];

export async function approveRequestAction(requestId: string) {
  return run(REQUEST_PATHS, (a) => approveRequest(a, requestId));
}

export async function rejectRequestAction(input: { requestId: string; reason: string }) {
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) } satisfies ActionResult;
  return run(REQUEST_PATHS, (a) => rejectRequest(a, parsed.data.requestId, parsed.data.reason));
}

export async function cancelApprovedRequestAction(requestId: string) {
  return run(REQUEST_PATHS, (a) => cancelApprovedRequest(a, requestId));
}

export async function createEmployeeAction(input: EmployeeCreateInput) {
  return run(EMPLOYEE_PATHS, (a) => createEmployee(a, input));
}
export async function updateEmployeeAction(input: EmployeeUpdateInput) {
  return run(EMPLOYEE_PATHS, (a) => updateEmployee(a, input));
}
export async function setEmployeeActiveAction(employeeId: string, active: boolean) {
  return run(EMPLOYEE_PATHS, (a) => setEmployeeActive(a, employeeId, active));
}
export async function adjustBalanceAction(input: AdjustBalanceInput) {
  return run(EMPLOYEE_PATHS, (a) => adjustBalance(a, input));
}
export async function allocateAnnualDaysAction(year: number) {
  return run(EMPLOYEE_PATHS.concat("/admin/configuracion"), (a) => allocateAnnualDays(a, year));
}

export async function savePolicyAction(input: PolicyInput) {
  return run(CONFIG_PATHS, (a) => savePolicyVersion(a, input));
}
export async function addHolidayAction(input: HolidayInput) {
  return run(CONFIG_PATHS, (a) => addHoliday(a, input));
}
export async function removeHolidayAction(id: string) {
  return run(CONFIG_PATHS, (a) => removeHoliday(a, id));
}
