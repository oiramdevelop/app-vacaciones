"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormErrors } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { addHolidayAction, removeHolidayAction } from "../actions";
import { holidaySchema, type HolidayInput } from "../schemas";

export function HolidayManager({ year, holidays }: { year: number; holidays: { id: string; date: string; name: string; region: string }[] }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: fieldErrors },
  } = useForm<HolidayInput>({ resolver: zodResolver(holidaySchema), defaultValues: { date: "", name: "", region: "" } });

  const onSubmit = handleSubmit((values) => {
    setErrors([]);
    startTransition(async () => {
      const result = await addHolidayAction(values);
      if (result.ok) reset();
      else setErrors(result.errors);
    });
  });

  const remove = (id: string) =>
    startTransition(async () => {
      const result = await removeHolidayAction(id);
      if (!result.ok) setErrors(result.errors);
    });

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} noValidate className="grid gap-3 sm:grid-cols-[10rem_1fr_9rem_auto] sm:items-start">
        <Field label="Fecha" htmlFor="hol-date" error={fieldErrors.date?.message}>
          <Input id="hol-date" type="date" min={`${year}-01-01`} max={`${year + 1}-12-31`} {...register("date")} />
        </Field>
        <Field label="Nombre" htmlFor="hol-name" error={fieldErrors.name?.message}>
          <Input id="hol-name" {...register("name")} />
        </Field>
        <Field label="Región" htmlFor="hol-region" hint="Vacío = general">
          <Input id="hol-region" {...register("region")} />
        </Field>
        <Button type="submit" disabled={pending} className="sm:mt-[1.625rem]">
          <Plus /> Añadir
        </Button>
      </form>
      <FormErrors errors={errors} />

      {holidays.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay festivos definidos en {year}.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {holidays.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{formatDate(h.date, "EEE d MMM")}</span> · {h.name}
                {h.region ? <span className="ml-2 text-xs text-muted-foreground">({h.region})</span> : null}
              </span>
              <Button variant="ghost" size="icon" className="size-8" disabled={pending} aria-label={`Eliminar ${h.name}`} onClick={() => remove(h.id)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
