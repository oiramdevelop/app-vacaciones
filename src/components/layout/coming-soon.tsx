import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Marcador para pantallas cuya lógica real llega en fases posteriores. */
export function ComingSoon({ phase, children }: { phase: string; children?: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Construction className="size-6" />
      </span>
      <p className="font-medium">Sección en construcción</p>
      <p className="max-w-md text-sm text-muted-foreground">{children ?? `Esta pantalla se implementará en la ${phase}.`}</p>
    </Card>
  );
}
