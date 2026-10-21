import "server-only";
import type { ISODate } from "@/features/vacations/domain/dates";

/** Fecha de hoy (yyyy-MM-dd) en la zona horaria de la empresa, no la del servidor. */
export function todayISO(now: Date = new Date(), timeZone = process.env.APP_TIMEZONE || "Europe/Madrid"): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
