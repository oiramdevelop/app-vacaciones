import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

/** Formatea una fecha de calendario `yyyy-MM-dd` sin pasar por zonas horarias. */
export function formatDate(isoDate: string, pattern = "d MMM yyyy") {
  return format(parseISO(isoDate), pattern, { locale: es });
}

export function formatRange(startIso: string, endIso: string) {
  return startIso === endIso ? formatDate(startIso) : `${formatDate(startIso, "d MMM")} – ${formatDate(endIso)}`;
}
