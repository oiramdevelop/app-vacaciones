import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { COMPANIES, COMPANY_LABELS, type Company } from "@/features/companies";

/** Pestañas Todas / Floramarket / Galacticblum que enlazan a `basePath?empresa=...`. */
export function CompanyTabs({ basePath, current }: { basePath: string; current?: Company }) {
  const options: { value?: Company; label: string }[] = [{ label: "Todas" }, ...COMPANIES.map((c) => ({ value: c, label: COMPANY_LABELS[c] }))];
  return (
    <div role="group" aria-label="Empresa" className="inline-flex rounded-md border bg-card p-0.5 text-sm">
      {options.map((o) => (
        <Button key={o.label} asChild variant={o.value === current ? "default" : "ghost"} size="sm">
          <Link href={o.value ? `${basePath}?empresa=${o.value}` : basePath}>{o.label}</Link>
        </Button>
      ))}
    </div>
  );
}

/** Selector `empresa` para los formularios de filtro GET. */
export function CompanySelect({ current }: { current?: Company }) {
  return (
    <div className="space-y-1">
      <label htmlFor="empresa" className="text-xs font-medium text-muted-foreground">Empresa</label>
      <Select id="empresa" name="empresa" defaultValue={current ?? ""} className="w-44">
        <option value="">Todas</option>
        {COMPANIES.map((c) => (
          <option key={c} value={c}>{COMPANY_LABELS[c]}</option>
        ))}
      </Select>
    </div>
  );
}
