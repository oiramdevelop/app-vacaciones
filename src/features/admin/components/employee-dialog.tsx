"use client";

import { useState, useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dices, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormErrors, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createEmployeeAction, updateEmployeeAction } from "../actions";
import { employeeCreateSchema, employeeUpdateSchema } from "../schemas";

export interface EmployeeFormTarget {
  id: string;
  name: string;
  email: string;
  role: "EMPLOYEE" | "ADMIN";
  hireDate: string;
}

interface FormValues {
  id: string;
  name: string;
  email: string;
  hireDate: string;
  role: "EMPLOYEE" | "ADMIN";
  password: string;
  newPassword: string;
  initialDays: number;
}

function generatePassword(length = 16): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function EmployeeDialog({
  employee,
  defaultDays,
  trigger,
}: {
  employee?: EmployeeFormTarget;
  defaultDays: number;
  trigger: React.ReactNode;
}) {
  const mode = employee ? "edit" : "create";
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors: fieldErrors },
  } = useForm<FormValues>({
    resolver: zodResolver(mode === "create" ? employeeCreateSchema : employeeUpdateSchema) as unknown as Resolver<FormValues>,
    defaultValues: {
      id: employee?.id ?? "",
      name: employee?.name ?? "",
      email: employee?.email ?? "",
      hireDate: employee?.hireDate ?? "",
      role: employee?.role ?? "EMPLOYEE",
      password: "",
      newPassword: "",
      initialDays: defaultDays,
    },
  });

  const onSubmit = handleSubmit((v) => {
    setErrors([]);
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createEmployeeAction({ name: v.name, email: v.email, hireDate: v.hireDate, role: v.role, password: v.password, initialDays: v.initialDays })
          : await updateEmployeeAction({ id: v.id, name: v.name, email: v.email, hireDate: v.hireDate, role: v.role, newPassword: v.newPassword });
      if (result.ok) {
        setOpen(false);
        reset();
      } else setErrors(result.errors);
    });
  });

  const passwordField = mode === "create" ? "password" : "newPassword";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setErrors([]);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={mode === "create" ? "Nuevo empleado" : "Editar empleado"}>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="emp-name" error={fieldErrors.name?.message} className="sm:col-span-2">
              <Input id="emp-name" autoComplete="off" {...register("name")} />
            </Field>
            <Field label="Email" htmlFor="emp-email" error={fieldErrors.email?.message} className="sm:col-span-2">
              <Input id="emp-email" type="email" autoComplete="off" {...register("email")} />
            </Field>
            <Field label="Fecha de incorporación" htmlFor="emp-hire" error={fieldErrors.hireDate?.message}>
              <Input id="emp-hire" type="date" {...register("hireDate")} />
            </Field>
            <Field label="Rol" htmlFor="emp-role">
              <Select id="emp-role" {...register("role")}>
                <option value="EMPLOYEE">Empleado</option>
                <option value="ADMIN">Administrador</option>
              </Select>
            </Field>
            {mode === "create" ? (
              <Field label="Días iniciales (año en curso)" htmlFor="emp-days" error={fieldErrors.initialDays?.message}>
                <Input id="emp-days" type="number" min={0} max={365} {...register("initialDays", { valueAsNumber: true })} />
              </Field>
            ) : null}
            <Field
              label={mode === "create" ? "Contraseña inicial" : "Nueva contraseña (opcional)"}
              htmlFor="emp-pass"
              error={fieldErrors[passwordField]?.message}
              hint="Mínimo 12 caracteres. Compártela por un canal seguro."
              className="sm:col-span-2"
            >
              <div className="flex gap-2">
                <Input id="emp-pass" type="text" autoComplete="new-password" {...register(passwordField)} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Generar contraseña"
                  aria-label="Generar contraseña"
                  onClick={() => setValue(passwordField, generatePassword(), { shouldValidate: true })}
                >
                  <Dices />
                </Button>
              </div>
            </Field>
          </div>

          <FormErrors errors={errors} />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {mode === "create" ? "Crear empleado" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
