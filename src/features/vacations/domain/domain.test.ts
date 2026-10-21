import { describe, expect, it } from "vitest";
import { computeYearBalance } from "./balance";
import { countComputableDays, type CountingRules } from "./calculate-days";
import { addDays, isoWeekday, isValidISODate, rangesOverlap } from "./dates";
import { validateRequest, type RequestRules, type ValidateRequestInput } from "./validate-request";

const working: CountingRules = { calculationType: "WORKING_DAYS", workingWeekdays: [1, 2, 3, 4, 5], excludeHolidays: true };
const calendar: CountingRules = { calculationType: "CALENDAR_DAYS", workingWeekdays: [1, 2, 3, 4, 5], excludeHolidays: true };
const noHolidays = new Set<string>();

describe("fechas", () => {
  it("valida fechas reales", () => {
    expect(isValidISODate("2026-02-28")).toBe(true);
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("2028-02-29")).toBe(true);
    expect(isValidISODate("2026-2-3")).toBe(false);
  });

  it("calcula el día de la semana ISO y cruza meses/años", () => {
    expect(isoWeekday("2026-10-12")).toBe(1); // lunes
    expect(isoWeekday("2026-10-11")).toBe(7); // domingo
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("detecta solapamientos incluyendo extremos", () => {
    expect(rangesOverlap({ start: "2026-05-01", end: "2026-05-05" }, { start: "2026-05-05", end: "2026-05-09" })).toBe(true);
    expect(rangesOverlap({ start: "2026-05-01", end: "2026-05-04" }, { start: "2026-05-05", end: "2026-05-09" })).toBe(false);
  });
});

describe("countComputableDays", () => {
  it("cuenta una semana laborable completa", () => {
    expect(countComputableDays("2026-10-05", "2026-10-09", working, noHolidays).total).toBe(5);
  });

  it("excluye fines de semana", () => {
    // lunes 5 a domingo 18 de octubre: 10 laborables
    expect(countComputableDays("2026-10-05", "2026-10-18", working, noHolidays).total).toBe(10);
    expect(countComputableDays("2026-10-10", "2026-10-11", working, noHolidays).total).toBe(0);
  });

  it("excluye festivos sólo si la política lo indica", () => {
    const holidays = new Set(["2026-10-12"]);
    expect(countComputableDays("2026-10-12", "2026-10-16", working, holidays).total).toBe(4);
    expect(countComputableDays("2026-10-12", "2026-10-16", { ...working, excludeHolidays: false }, holidays).total).toBe(5);
  });

  it("un festivo en fin de semana no se descuenta dos veces", () => {
    const holidays = new Set(["2026-10-10"]); // sábado
    expect(countComputableDays("2026-10-05", "2026-10-11", working, holidays).total).toBe(5);
  });

  it("en días naturales cuenta todo", () => {
    expect(countComputableDays("2026-10-05", "2026-10-18", calendar, new Set(["2026-10-12"])).total).toBe(14);
  });

  it("respeta una semana laborable personalizada (lunes a sábado)", () => {
    const sixDays = { ...working, workingWeekdays: [1, 2, 3, 4, 5, 6] };
    expect(countComputableDays("2026-10-05", "2026-10-11", sixDays, noHolidays).total).toBe(6);
  });

  it("reparte por año en un periodo que cruza fin de año", () => {
    const holidays = new Set(["2026-12-25", "2027-01-01"]);
    // 28 dic 2026 (lun) a 8 ene 2027 (vie): 2026 -> 28,29,30,31 = 4; 2027 -> 4,5,6,7,8 = 5 (1 ene festivo)
    const result = countComputableDays("2026-12-28", "2027-01-08", working, holidays);
    expect(result.byYear).toEqual({ 2026: 4, 2027: 5 });
    expect(result.total).toBe(9);
  });

  it("maneja el 29 de febrero", () => {
    expect(countComputableDays("2028-02-28", "2028-03-01", calendar, noHolidays).total).toBe(3);
  });
});

describe("computeYearBalance", () => {
  const today = "2026-10-08";

  it("separa disfrutados, comprometidos y pendientes", () => {
    const balance = computeYearBalance({
      year: 2026,
      today,
      pendingDays: 5,
      ledger: [
        { type: "ALLOCATION", days: 22 },
        { type: "ADJUSTMENT", days: 2 },
        { type: "CONSUMPTION", days: -5, requestStart: "2026-08-03" },
        { type: "CONSUMPTION", days: -8, requestStart: "2026-12-21" },
      ],
    });
    expect(balance).toEqual({ year: 2026, assigned: 24, used: 5, committed: 8, pending: 5, available: 6 });
  });

  it("una devolución restaura el saldo", () => {
    const balance = computeYearBalance({
      year: 2026,
      today,
      pendingDays: 0,
      ledger: [
        { type: "ALLOCATION", days: 22 },
        { type: "CONSUMPTION", days: -8, requestStart: "2026-12-21" },
        { type: "REFUND", days: 8, requestStart: "2026-12-21" },
      ],
    });
    expect(balance.available).toBe(22);
    expect(balance.committed).toBe(0);
  });

  it("el tramo de un año posterior de una solicitud que cruza el fin de año cuenta como comprometido", () => {
    // La solicitud empezó en 2026 (ya iniciada) pero el tramo de 2027 aún no ha llegado.
    const balance = computeYearBalance({
      year: 2027,
      today: "2026-12-30",
      pendingDays: 0,
      ledger: [
        { type: "ALLOCATION", days: 22 },
        { type: "CONSUMPTION", days: -5, requestStart: "2026-12-28" },
      ],
    });
    expect(balance.committed).toBe(5);
    expect(balance.used).toBe(0);
  });
});

describe("validateRequest", () => {
  const rules: RequestRules = { ...working, allowFutureRequests: true, maxAdvanceDays: null, minNoticeDays: 0 };
  const base: ValidateRequestInput = {
    startDate: "2026-11-02",
    endDate: "2026-11-06",
    today: "2026-10-08",
    rules,
    holidays: noHolidays,
    blockedRanges: [],
    availableByYear: { 2026: 10 },
  };

  it("acepta una solicitud válida y calcula el saldo restante", () => {
    const result = validateRequest(base);
    expect(result).toEqual({ ok: true, totalDays: 5, daysByYear: { 2026: 5 }, remainingByYear: { 2026: 5 } });
  });

  it("rechaza inicio posterior al fin", () => {
    const result = validateRequest({ ...base, startDate: "2026-11-06", endDate: "2026-11-02" });
    expect(result.ok).toBe(false);
  });

  it("rechaza fechas pasadas", () => {
    const result = validateRequest({ ...base, startDate: "2026-10-01", endDate: "2026-10-02" });
    expect(result.ok).toBe(false);
  });

  it("rechaza solapamiento con solicitudes existentes", () => {
    const result = validateRequest({ ...base, blockedRanges: [{ start: "2026-11-05", end: "2026-11-10" }] });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.errors.join(" ")).toContain("solapa");
  });

  it("rechaza saldo insuficiente", () => {
    const result = validateRequest({ ...base, availableByYear: { 2026: 4 } });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.errors.join(" ")).toContain("Saldo insuficiente");
  });

  it("permite usar exactamente todo el saldo", () => {
    expect(validateRequest({ ...base, availableByYear: { 2026: 5 } }).ok).toBe(true);
  });

  it("rechaza un periodo sin días computables", () => {
    const result = validateRequest({ ...base, startDate: "2026-11-07", endDate: "2026-11-08" });
    expect(result.ok).toBe(false);
  });

  it("comprueba el saldo de cada año en un periodo que cruza de año", () => {
    const crossing = { ...base, startDate: "2026-12-28", endDate: "2027-01-08", holidays: new Set(["2027-01-01"]) };
    expect(validateRequest({ ...crossing, availableByYear: { 2026: 4, 2027: 5 } }).ok).toBe(true);
    const short = validateRequest({ ...crossing, availableByYear: { 2026: 4, 2027: 4 } });
    expect(short.ok).toBe(false);
    // Sin asignación para 2027 el año cuenta como 0 disponibles.
    expect(validateRequest({ ...crossing, availableByYear: { 2026: 4 } }).ok).toBe(false);
  });

  it("aplica antelación mínima y máxima", () => {
    expect(validateRequest({ ...base, rules: { ...rules, minNoticeDays: 30 } }).ok).toBe(false);
    expect(validateRequest({ ...base, rules: { ...rules, maxAdvanceDays: 10 } }).ok).toBe(false);
  });

  it("sin permiso para años futuros rechaza periodos que llegan al año siguiente", () => {
    const crossing = { ...base, startDate: "2026-12-28", endDate: "2027-01-08", availableByYear: { 2026: 10, 2027: 10 } };
    expect(validateRequest({ ...crossing, rules: { ...rules, allowFutureRequests: false } }).ok).toBe(false);
    expect(validateRequest({ ...crossing, rules }).ok).toBe(true);
  });

  it("limita la duración máxima del periodo", () => {
    const result = validateRequest({ ...base, startDate: "2026-11-01", endDate: "2028-01-01" });
    expect(result.ok).toBe(false);
  });
});
