/**
 * Fechas de calendario como cadenas ISO `yyyy-MM-dd`. Nunca se usa la zona horaria local:
 * todas las operaciones se hacen en UTC sobre la fecha, de modo que no hay desfases por zona
 * horaria ni por cambios de hora.
 */
export type ISODate = string;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidISODate(value: string): boolean {
  if (!ISO_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function toUTCDate(iso: ISODate): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function fromUTCDate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = toUTCDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTCDate(d);
}

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export function isoWeekday(iso: ISODate): number {
  const day = toUTCDate(iso).getUTCDay();
  return day === 0 ? 7 : day;
}

export function yearOf(iso: ISODate): number {
  return Number(iso.slice(0, 4));
}

export function diffInDays(from: ISODate, to: ISODate): number {
  return Math.round((toUTCDate(to).getTime() - toUTCDate(from).getTime()) / 86_400_000);
}

export function* eachDay(start: ISODate, end: ISODate): Generator<ISODate> {
  for (let d = start; d <= end; d = addDays(d, 1)) yield d;
}

export function yearsBetween(start: ISODate, end: ISODate): number[] {
  const years: number[] = [];
  for (let y = yearOf(start); y <= yearOf(end); y++) years.push(y);
  return years;
}

export function rangesOverlap(a: { start: ISODate; end: ISODate }, b: { start: ISODate; end: ISODate }): boolean {
  return a.start <= b.end && b.start <= a.end;
}
