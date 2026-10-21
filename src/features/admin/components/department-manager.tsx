"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormErrors } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createDepartmentAction, deleteDepartmentAction, renameDepartmentAction } from "../actions";

interface Dept {
  id: string;
  name: string;
  employees: number;
}

export function DepartmentManager({ departments }: { departments: Dept[] }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; errors?: string[] }>, onOk?: () => void) =>
    startTransition(async () => {
      setErrors([]);
      const result = await fn();
      if (result.ok) onOk?.();
      else setErrors(result.errors ?? []);
    });

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createDepartmentAction({ name: newName }), () => setNewName(""));
        }}
      >
        <Input aria-label="Nuevo departamento" placeholder="Nuevo departamento" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} />
        <Button type="submit" disabled={pending || newName.trim().length < 2}>
          <Plus /> Añadir
        </Button>
      </form>
      <FormErrors errors={errors} />

      <ul className="divide-y rounded-md border">
        {departments.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            {editing?.id === d.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => renameDepartmentAction(d.id, { name: editing.name }), () => setEditing(null));
                }}
              >
                <Input aria-label="Nombre del departamento" value={editing.name} onChange={(e) => setEditing({ id: d.id, name: e.target.value })} className="h-8" autoFocus />
                <Button type="submit" size="icon" className="size-8" disabled={pending} aria-label="Guardar"><Check /></Button>
                <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => setEditing(null)} aria-label="Cancelar"><X /></Button>
              </form>
            ) : (
              <>
                <span>
                  <span className="font-medium">{d.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{d.employees} empleado(s)</span>
                </span>
                <span className="flex gap-1">
                  <Button variant="ghost" size="icon" className="size-8" aria-label={`Renombrar ${d.name}`} onClick={() => setEditing({ id: d.id, name: d.name })}>
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={pending || d.employees > 0}
                    title={d.employees > 0 ? "Reasigna a sus empleados antes de eliminarlo" : "Eliminar"}
                    aria-label={`Eliminar ${d.name}`}
                    onClick={() => run(() => deleteDepartmentAction(d.id))}
                  >
                    <Trash2 />
                  </Button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
