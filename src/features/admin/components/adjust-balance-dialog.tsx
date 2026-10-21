"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormErrors } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { adjustBalanceAction } from "../actions";
import { adjustBalanceSchema, type AdjustBalanceInput } from "../schemas";

export function AdjustBalanceDialog({
  employeeId,
  employeeName,
  year,
  available,
  trigger,
}: {
  employeeId: string;
  employeeName: string;
  year: number;
  available: number;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: fieldErrors },
  } = useForm<AdjustBalanceInput>({
    resolver: zodResolver(adjustBalanceSchema),
    defaultValues: { employeeId, year, days: 0, reason: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setErrors([]);
    startTransition(async () => {
      const result = await adjustBalanceAction(values);
      if (result.ok) {
        setOpen(false);
        reset();
      } else setErrors(result.errors);
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title="Ajustar saldo"
        description={`${employeeName} · ${year} · ${available} días disponibles. El ajuste queda registrado en el libro de saldos y en la auditoría.`}
      >
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Días (positivo suma, negativo resta)" htmlFor="adj-days" error={fieldErrors.days?.message}>
            <Input id="adj-days" type="number" step={1} {...register("days", { valueAsNumber: true })} />
          </Field>
          <Field label="Motivo" htmlFor="adj-reason" error={fieldErrors.reason?.message}>
            <Input id="adj-reason" maxLength={200} {...register("reason")} />
          </Field>
          <FormErrors errors={errors} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Aplicar ajuste
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
