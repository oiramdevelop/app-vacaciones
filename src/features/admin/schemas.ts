import { z } from "zod";
import { isValidISODate } from "@/features/vacations/domain/dates";

const id = z.string().min(1).max(64);
const isoDate = z.string().refine(isValidISODate, "Fecha no válida");
const password = z.string().min(12, "Mínimo 12 caracteres").max(100, "Máximo 100 caracteres");

export const employeeBaseSchema = z.object({
  name: z.string().trim().min(2, "Indica el nombre").max(100),
  email: z.string().trim().toLowerCase().email("Email no válido").max(254),
  hireDate: isoDate,
  role: z.enum(["EMPLOYEE", "ADMIN"]),
});

export const employeeCreateSchema = employeeBaseSchema.extend({
  password,
  initialDays: z.number().int("Debe ser un número entero").min(0).max(365),
});
export type EmployeeCreateInput = z.input<typeof employeeCreateSchema>;

export const employeeUpdateSchema = employeeBaseSchema.extend({
  id,
  // Vacío = no cambiar la contraseña.
  newPassword: z.union([z.literal(""), password]),
});
export type EmployeeUpdateInput = z.input<typeof employeeUpdateSchema>;

export const adjustBalanceSchema = z.object({
  employeeId: id,
  year: z.number().int().min(2000).max(2100),
  days: z
    .number()
    .int("Debe ser un número entero")
    .min(-365)
    .max(365)
    .refine((n) => n !== 0, "El ajuste no puede ser 0"),
  reason: z.string().trim().min(3, "Indica un motivo").max(200),
});
export type AdjustBalanceInput = z.input<typeof adjustBalanceSchema>;

export const rejectSchema = z.object({
  requestId: id,
  reason: z.string().trim().min(3, "Indica el motivo del rechazo").max(300),
});
export type RejectInput = z.input<typeof rejectSchema>;

export const policySchema = z
  .object({
    name: z.string().trim().min(2, "Indica un nombre").max(100),
    annualDays: z.number().int().min(0).max(365),
    calculationType: z.enum(["WORKING_DAYS", "CALENDAR_DAYS"]),
    workingWeekdays: z.array(z.number().int().min(1).max(7)).min(1, "Elige al menos un día laborable"),
    excludeHolidays: z.boolean(),
    allowFutureRequests: z.boolean(),
    maxAdvanceDays: z.number().int().min(0).max(730).nullable(),
    minNoticeDays: z.number().int().min(0).max(365),
    requiresApproval: z.boolean(),
    holidayRegion: z.string().trim().max(50),
    effectiveFrom: isoDate,
  })
  .refine((p) => new Set(p.workingWeekdays).size === p.workingWeekdays.length, "Días laborables repetidos");
export type PolicyInput = z.input<typeof policySchema>;

export const holidaySchema = z.object({
  date: isoDate,
  name: z.string().trim().min(2, "Indica el nombre").max(100),
  region: z.string().trim().max(50),
});
export type HolidayInput = z.input<typeof holidaySchema>;

export const idSchema = id;
export const yearSchema = z.number().int().min(2000).max(2100);
