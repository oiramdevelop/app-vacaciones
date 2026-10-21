"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DayPicker, type DateRange } from "react-day-picker";
import { es } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { format, parseISO } from "date-fns";
import { AlertCircle, CalendarCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatDate } from "@/lib/format";
import { createRequestAction } from "../actions";
import { requestInputSchema, type RequestInput } from "../schemas";
import { validateRequest, type RequestRules } from "../domain/validate-request";

interface RequestFormProps {
  today: string;
  rules: RequestRules;
  holidays: string[];
  blockedRanges: { start: string; end: string }[];
  /** Días disponibles por año, para vista previa (el servidor vuelve a validar). */
  availableByYear: Record<number, number>;
}

const toISO = (d: Date) => format(d, "yyyy-MM-dd");

export function RequestForm({ today, rules, holidays, blockedRanges, availableByYear }: RequestFormProps) {
  const router = useRouter();
  const wide = useMediaQuery("(min-width: 1280px)");
  const [range, setRange] = useState<DateRange | undefined>();
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const { register, handleSubmit, setValue, formState } = useForm<RequestInput>({
    resolver: zodResolver(requestInputSchema),
    defaultValues: { startDate: "", endDate: "", reason: "" },
  });

  const startDate = range?.from ? toISO(range.from) : "";
  // Con un solo clic se previsualiza un periodo de un día.
  const endDate = range?.from ? toISO(range.to ?? range.from) : "";

  const holidaySet = useMemo(() => new Set(holidays), [holidays]);
  const preview = useMemo(
    () => (startDate ? validateRequest({ startDate, endDate, today, rules, holidays: holidaySet, blockedRanges, availableByYear }) : null),
    [startDate, endDate, today, rules, holidaySet, blockedRanges, availableByYear],
  );

  const nonWorkingDays = [0, 1, 2, 3, 4, 5, 6].filter((js) => !rules.workingWeekdays.includes(js === 0 ? 7 : js));

  function onSelect(next: DateRange | undefined) {
    setRange(next);
    setServerErrors([]);
    setValue("startDate", next?.from ? toISO(next.from) : "", { shouldValidate: true });
    setValue("endDate", next?.from ? toISO(next.to ?? next.from) : "", { shouldValidate: true });
  }

  const onSubmit = handleSubmit((values) => {
    setServerErrors([]);
    startTransition(async () => {
      const result = await createRequestAction(values);
      if (result.ok) router.push("/vacaciones/mis-solicitudes?creada=1");
      else setServerErrors(result.errors);
    });
  });

  const errors = [...(preview && !preview.ok ? preview.errors : []), ...serverErrors];

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-[auto_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Elige las fechas</CardTitle>
          <CardDescription>Pulsa el primer día y el último. Para un solo día, pulsa dos veces el mismo.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <DayPicker
            mode="range"
            locale={es}
            weekStartsOn={1}
            numberOfMonths={wide ? 2 : 1}
            selected={range}
            onSelect={onSelect}
            excludeDisabled
            startMonth={parseISO(today)}
            disabled={[{ before: parseISO(today) }, ...blockedRanges.map((r) => ({ from: parseISO(r.start), to: parseISO(r.end) }))]}
            modifiers={{
              holiday: holidays.map((h) => parseISO(h)),
              nonworking: { dayOfWeek: nonWorkingDays },
              blocked: blockedRanges.map((r) => ({ from: parseISO(r.start), to: parseISO(r.end) })),
            }}
            modifiersClassNames={{ holiday: "rdp-holiday", nonworking: "rdp-nonworking", blocked: "rdp-blocked" }}
          />
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5"><span className="size-3 rounded bg-warning-soft" /> Festivo</li>
            <li className="flex items-center gap-1.5"><span className="size-3 rounded bg-secondary" /> Ya solicitado</li>
            <li className="flex items-center gap-1.5"><span className="size-3 rounded bg-primary" /> Selección</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {startDate ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Inicio</dt>
                <dd className="font-medium">{formatDate(startDate, "EEE d MMM yyyy")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fin</dt>
                <dd className="font-medium">{formatDate(endDate, "EEE d MMM yyyy")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Días computables</dt>
                <dd className="text-2xl font-semibold">{preview?.totalDays ?? 0}</dd>
              </div>
              {preview?.ok
                ? Object.entries(preview.remainingByYear).map(([year, remaining]) => (
                    <div key={year}>
                      <dt className="text-muted-foreground">Te quedarían en {year}</dt>
                      <dd className="text-2xl font-semibold">{remaining}</dd>
                    </div>
                  ))
                : null}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Selecciona un periodo en el calendario para ver cuántos días consume.</p>
          )}

          <div className="space-y-1.5">
            <label htmlFor="reason" className="text-sm font-medium">
              Comentario <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <Textarea id="reason" maxLength={500} {...register("reason")} />
            {formState.errors.reason ? <p className="text-xs text-destructive">{formState.errors.reason.message}</p> : null}
          </div>

          {errors.length > 0 ? (
            <ul role="alert" className="space-y-1 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              {errors.map((e) => (
                <li key={e} className="flex gap-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {e}
                </li>
              ))}
            </ul>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending || !preview?.ok}>
            {pending ? <Loader2 className="animate-spin" /> : <CalendarCheck />}
            Confirmar solicitud
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
