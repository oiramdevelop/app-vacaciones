import { eachDay, isoWeekday, yearOf, type ISODate } from "./dates";

export interface CountingRules {
  calculationType: "WORKING_DAYS" | "CALENDAR_DAYS";
  /** Días laborables, ISO 1 (lunes) … 7 (domingo). */
  workingWeekdays: number[];
  excludeHolidays: boolean;
}

export interface DayCount {
  total: number;
  /** Días computables por año natural (los saldos son anuales). */
  byYear: Record<number, number>;
}

/**
 * Días que consume un periodo (ambos extremos incluidos).
 * - CALENDAR_DAYS: todos los días naturales.
 * - WORKING_DAYS: sólo los días laborables de la política y, si procede, sin festivos.
 */
export function countComputableDays(start: ISODate, end: ISODate, rules: CountingRules, holidays: ReadonlySet<ISODate>): DayCount {
  const byYear: Record<number, number> = {};
  let total = 0;

  for (const day of eachDay(start, end)) {
    if (rules.calculationType === "WORKING_DAYS") {
      if (!rules.workingWeekdays.includes(isoWeekday(day))) continue;
      if (rules.excludeHolidays && holidays.has(day)) continue;
    }
    total += 1;
    const year = yearOf(day);
    byYear[year] = (byYear[year] ?? 0) + 1;
  }
  return { total, byYear };
}
