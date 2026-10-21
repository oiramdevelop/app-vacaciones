import { countComputableDays, type CountingRules } from "./calculate-days";
import { addDays, diffInDays, isValidISODate, rangesOverlap, yearOf, type ISODate } from "./dates";

export interface RequestRules extends CountingRules {
  allowFutureRequests: boolean;
  maxAdvanceDays: number | null;
  minNoticeDays: number;
}

export interface ValidateRequestInput {
  startDate: ISODate;
  endDate: ISODate;
  today: ISODate;
  rules: RequestRules;
  holidays: ReadonlySet<ISODate>;
  /** Periodos PENDING/APPROVED del propio empleado. */
  blockedRanges: { start: ISODate; end: ISODate }[];
  /** Días disponibles por año (los años ausentes cuentan como 0). */
  availableByYear: Record<number, number>;
}

export type ValidationResult =
  | { ok: true; totalDays: number; daysByYear: Record<number, number>; remainingByYear: Record<number, number> }
  | { ok: false; errors: string[]; totalDays?: number };

export const MAX_RANGE_DAYS = 366;

/**
 * Reglas de negocio de una solicitud. Función pura: la usan el formulario (vista previa)
 * y el servidor (validación definitiva dentro de la transacción).
 */
export function validateRequest(input: ValidateRequestInput): ValidationResult {
  const { startDate, endDate, today, rules, holidays, blockedRanges, availableByYear } = input;
  const errors: string[] = [];

  if (!isValidISODate(startDate) || !isValidISODate(endDate)) return { ok: false, errors: ["Las fechas no son válidas."] };
  if (startDate > endDate) return { ok: false, errors: ["La fecha de inicio debe ser anterior o igual a la fecha de fin."] };
  if (diffInDays(startDate, endDate) + 1 > MAX_RANGE_DAYS) {
    return { ok: false, errors: [`El periodo no puede superar ${MAX_RANGE_DAYS} días.`] };
  }

  if (startDate < today) errors.push("No se pueden solicitar vacaciones con fecha de inicio pasada.");

  if (startDate >= today) {
    if (rules.minNoticeDays > 0 && startDate < addDays(today, rules.minNoticeDays)) {
      errors.push(`Debes solicitarlas con al menos ${rules.minNoticeDays} días de antelación.`);
    }
    if (rules.maxAdvanceDays !== null && startDate > addDays(today, rules.maxAdvanceDays)) {
      errors.push(`No se puede solicitar con más de ${rules.maxAdvanceDays} días de antelación.`);
    }
  }
  if (!rules.allowFutureRequests && yearOf(endDate) > yearOf(today)) {
    errors.push("La política no permite solicitar días de años futuros.");
  }

  if (blockedRanges.some((r) => rangesOverlap({ start: startDate, end: endDate }, r))) {
    errors.push("El periodo se solapa con otra solicitud pendiente o aprobada.");
  }

  const { total, byYear } = countComputableDays(startDate, endDate, rules, holidays);
  if (total === 0) {
    errors.push("El periodo no incluye ningún día computable (fines de semana o festivos).");
  }

  const remainingByYear: Record<number, number> = {};
  for (const [yearKey, days] of Object.entries(byYear)) {
    const year = Number(yearKey);
    const available = availableByYear[year] ?? 0;
    remainingByYear[year] = available - days;
    if (days > available) {
      errors.push(`Saldo insuficiente en ${year}: solicitas ${days} ${days === 1 ? "día" : "días"} y tienes ${Math.max(available, 0)} disponibles.`);
    }
  }

  return errors.length > 0
    ? { ok: false, errors, totalDays: total }
    : { ok: true, totalDays: total, daysByYear: byYear, remainingByYear };
}
