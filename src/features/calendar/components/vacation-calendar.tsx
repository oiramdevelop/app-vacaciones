"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface CalendarAbsence {
  id: string;
  employeeName: string;
  start: string; // yyyy-MM-dd
  end: string;
}

export interface CalendarHoliday {
  date: string;
  name: string;
}

type View = "month" | "week";
const WEEK = { weekStartsOn: 1 } as const;
const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Calendario mensual/semanal de ausencias. Sólo muestra nombre y fechas. */
export function VacationCalendar({
  absences,
  holidays,
  today,
}: {
  absences: CalendarAbsence[];
  holidays: CalendarHoliday[];
  today: string;
}) {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => parseISO(today));
  const [selected, setSelected] = useState<string>(today);

  const holidayByDate = useMemo(() => new Map(holidays.map((h) => [h.date, h.name])), [holidays]);
  const absencesOn = (day: string) => absences.filter((a) => a.start <= day && day <= a.end);

  const days = useMemo(
    () =>
      view === "month"
        ? eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor), WEEK), end: endOfWeek(endOfMonth(cursor), WEEK) })
        : eachDayOfInterval({ start: startOfWeek(cursor, WEEK), end: endOfWeek(cursor, WEEK) }),
    [cursor, view],
  );

  const title =
    view === "month"
      ? format(cursor, "LLLL yyyy", { locale: es })
      : `${format(days[0]!, "d MMM", { locale: es })} – ${format(days[6]!, "d MMM yyyy", { locale: es })}`;

  const step = (dir: 1 | -1) => setCursor((c) => (view === "month" ? addMonths(c, dir) : addWeeks(c, dir)));
  const selectedAbsences = absencesOn(selected);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="size-9" onClick={() => step(-1)} aria-label="Anterior">
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon" className="size-9" onClick={() => step(1)} aria-label="Siguiente">
              <ChevronRight />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCursor(parseISO(today));
                setSelected(today);
              }}
            >
              Hoy
            </Button>
            <h2 className="ml-2 text-base font-semibold capitalize">{title}</h2>
          </div>
          <div role="group" aria-label="Vista" className="inline-flex rounded-md border bg-secondary p-0.5">
            {(["month", "week"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={cn("rounded px-3 py-1.5 text-sm font-medium", view === v ? "bg-card shadow-xs" : "text-muted-foreground")}
              >
                {v === "month" ? "Mes" : "Semana"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-7 border-b pb-2 text-center text-xs font-medium uppercase text-muted-foreground">
          {days.slice(0, 7).map((d) => (
            <div key={iso(d)}>{format(d, "EEE", { locale: es })}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-border pt-px">
          {days.map((d) => {
            const key = iso(d);
            const list = absencesOn(key);
            const holiday = holidayByDate.get(key);
            const weekend = d.getDay() === 0 || d.getDay() === 6;
            const outside = view === "month" && !isSameMonth(d, cursor);
            const limit = view === "week" ? 20 : 3;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                aria-label={`${format(d, "d 'de' MMMM", { locale: es })}: ${list.length} ausencias`}
                aria-pressed={selected === key}
                className={cn(
                  "flex flex-col items-stretch gap-1 bg-card p-1 text-left transition-colors hover:bg-accent/60 sm:p-1.5",
                  view === "month" ? "min-h-16 sm:min-h-24" : "min-h-32 sm:min-h-64",
                  weekend && "bg-secondary/50",
                  outside && "opacity-45",
                  selected === key && "ring-2 ring-inset ring-primary",
                )}
              >
                <span className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                      key === today && "bg-primary text-primary-foreground",
                    )}
                  >
                    {format(d, "d")}
                  </span>
                  {holiday ? <span className="size-1.5 rounded-full bg-warning" title={holiday} /> : null}
                </span>
                {holiday ? <span className="hidden truncate text-[10px] text-warning sm:block">{holiday}</span> : null}
                <span className="hidden flex-col gap-0.5 sm:flex">
                  {list.slice(0, limit).map((a) => (
                    <span key={a.id} className="truncate rounded bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">
                      {a.employeeName}
                    </span>
                  ))}
                  {list.length > limit ? <span className="px-1 text-[11px] text-muted-foreground">+{list.length - limit} más</span> : null}
                </span>
                {list.length > 0 ? (
                  <span className="mt-auto self-start rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-foreground sm:hidden">
                    {list.length}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold capitalize">{format(parseISO(selected), "EEEE d 'de' MMMM", { locale: es })}</h3>
        {holidayByDate.has(selected) ? <p className="mt-1 text-sm text-warning">Festivo: {holidayByDate.get(selected)}</p> : null}
        {selectedAbsences.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nadie ausente este día.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {selectedAbsences.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="font-medium">{a.employeeName}</span>
                <span className="text-muted-foreground">
                  {format(parseISO(a.start), "d MMM", { locale: es })} – {format(parseISO(a.end), "d MMM", { locale: es })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
