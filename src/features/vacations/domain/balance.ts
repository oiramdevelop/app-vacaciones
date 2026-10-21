import type { ISODate } from "./dates";

export type LedgerType = "ALLOCATION" | "ADJUSTMENT" | "CONSUMPTION" | "REFUND";

export interface LedgerLine {
  type: LedgerType;
  days: number;
  /** Fechas de la solicitud asociada (CONSUMPTION / REFUND). */
  requestStart?: ISODate | null;
}

export interface YearBalance {
  year: number;
  /** Asignación anual + ajustes manuales. */
  assigned: number;
  /** Consumidos en periodos ya iniciados. */
  used: number;
  /** Aprobados cuyo periodo aún no ha empezado. */
  committed: number;
  /** En solicitudes pendientes de aprobación. */
  pending: number;
  available: number;
}

/**
 * Saldo de un año a partir del libro mayor. `committed` y `used` se reparten según el inicio
 * del tramo de la solicitud que cae dentro de ese año; los pendientes aún no tocan el libro.
 */
export function computeYearBalance(params: { year: number; today: ISODate; ledger: LedgerLine[]; pendingDays: number }): YearBalance {
  const { year, today, ledger, pendingDays } = params;
  const yearStart = `${year}-01-01`;

  let assigned = 0;
  let used = 0;
  let committed = 0;

  for (const line of ledger) {
    if (line.type === "ALLOCATION" || line.type === "ADJUSTMENT") {
      assigned += line.days;
      continue;
    }
    const consumed = -line.days; // CONSUMPTION < 0, REFUND > 0
    const portionStart = line.requestStart && line.requestStart > yearStart ? line.requestStart : yearStart;
    if (portionStart <= today) used += consumed;
    else committed += consumed;
  }

  return { year, assigned, used, committed, pending: pendingDays, available: assigned - used - committed - pendingDays };
}
