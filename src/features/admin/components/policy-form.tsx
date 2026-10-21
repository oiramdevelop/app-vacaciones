"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormErrors, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { savePolicyAction } from "../actions";
import { policySchema, type PolicyInput } from "../schemas";

const WEEKDAYS = [
  { value: 1, label: "L" },
  { value: 2, label: "M" },
  { value: 3, label: "X" },
  { value: 4, label: "J" },
  { value: 5, label: "V" },
  { value: 6, label: "S" },
  { value: 7, label: "D" },
];

function Toggle({ id, label, hint, ...props }: { id: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary has-[:checked]:bg-accent/50">
      <input id={id} type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" {...props} />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

export function PolicyForm({ initial, today }: { initial: PolicyInput; today: string }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors: fieldErrors },
  } = useForm<PolicyInput>({ resolver: zodResolver(policySchema), defaultValues: initial });

  const weekdays = useWatch({ control, name: "workingWeekdays" });
  const calculationType = useWatch({ control, name: "calculationType" });

  const onSubmit = handleSubmit((values) => {
    setErrors([]);
    setSaved(false);
    startTransition(async () => {
      const result = await savePolicyAction(values);
      if (result.ok) setSaved(true);
      else setErrors(result.errors);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre de esta versión" htmlFor="pol-name" error={fieldErrors.name?.message}>
          <Input id="pol-name" {...register("name")} />
        </Field>
        <Field label="Entra en vigor el" htmlFor="pol-from" error={fieldErrors.effectiveFrom?.message} hint="Se aplica a solicitudes que empiecen desde esta fecha.">
          <Input id="pol-from" type="date" min={today} {...register("effectiveFrom")} />
        </Field>
        <Field label="Días anuales por defecto" htmlFor="pol-days" error={fieldErrors.annualDays?.message}>
          <Input id="pol-days" type="number" min={0} max={365} {...register("annualDays", { valueAsNumber: true })} />
        </Field>
        <Field label="Cómputo" htmlFor="pol-calc">
          <Select id="pol-calc" {...register("calculationType")}>
            <option value="WORKING_DAYS">Días laborables</option>
            <option value="CALENDAR_DAYS">Días naturales</option>
          </Select>
        </Field>
      </div>

      <fieldset className={cn("space-y-2", calculationType === "CALENDAR_DAYS" && "opacity-50")}>
        <legend className="text-sm font-medium">Días laborables de la semana (fines de semana)</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => {
            const active = weekdays.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                aria-pressed={active}
                disabled={calculationType === "CALENDAR_DAYS"}
                onClick={() =>
                  setValue("workingWeekdays", active ? weekdays.filter((w) => w !== d.value) : [...weekdays, d.value], { shouldValidate: true })
                }
                className={cn(
                  "size-10 rounded-md border text-sm font-medium",
                  active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
                )}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        {fieldErrors.workingWeekdays?.message ? <p className="text-xs text-destructive">{fieldErrors.workingWeekdays.message}</p> : null}
        <p className="text-xs text-muted-foreground">Con cómputo en días naturales se cuentan todos los días, sin excluir fines de semana ni festivos.</p>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle id="pol-holidays" label="Excluir festivos" hint="Los festivos no consumen días (cómputo laborable)." {...register("excludeHolidays")} />
        <Toggle id="pol-future" label="Permitir solicitar días futuros" hint="Si se desmarca, un periodo no puede llegar a un año posterior al actual." {...register("allowFutureRequests")} />
        <Toggle id="pol-approval" label="Requiere aprobación" hint="Si se desmarca, las solicitudes válidas se aprueban automáticamente." {...register("requiresApproval")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Antelación mínima (días)" htmlFor="pol-notice" error={fieldErrors.minNoticeDays?.message}>
          <Input id="pol-notice" type="number" min={0} {...register("minNoticeDays", { valueAsNumber: true })} />
        </Field>
        <Field label="Antelación máxima (días)" htmlFor="pol-max" error={fieldErrors.maxAdvanceDays?.message} hint="Vacío = sin límite">
          <Input
            id="pol-max"
            type="number"
            min={0}
            {...register("maxAdvanceDays", { setValueAs: (v) => (v === "" || v === null || v === undefined ? null : Number(v)) })}
          />
        </Field>
        <Field label="Región de festivos" htmlFor="pol-region" hint="Vacío = sólo festivos generales">
          <Input id="pol-region" {...register("holidayRegion")} />
        </Field>
      </div>

      <FormErrors errors={errors} />
      {saved ? (
        <p role="status" className="flex items-center gap-2 rounded-md bg-success-soft px-3 py-2 text-sm text-success">
          <CheckCircle2 className="size-4" /> Nueva versión de la política guardada. Las solicitudes anteriores conservan sus reglas.
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Guardar como nueva versión
      </Button>
    </form>
  );
}
