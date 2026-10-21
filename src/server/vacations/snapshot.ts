import { fromUTCDate } from "@/features/vacations/domain/dates";

/** Días de una solicitud repartidos por año, según el snapshot guardado al crearla. */
export function daysByYearOf(request: { policySnapshot: unknown; startDate: Date; totalDays: number }): Record<number, number> {
  const stored = (request.policySnapshot as { daysByYear?: Record<string, number> } | null)?.daysByYear;
  if (stored) return Object.fromEntries(Object.entries(stored).map(([y, d]) => [Number(y), d]));
  // Respaldo para solicitudes sin reparto anual: todo el consumo cae en el año de inicio.
  return { [Number(fromUTCDate(request.startDate).slice(0, 4))]: request.totalDays };
}
