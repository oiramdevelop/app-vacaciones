import Image from "next/image";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

/** Logo de la app (Floramarket + Galacticblum). Original a tamaño completo en branding/. */
export function AppLogo({ size, className, priority }: { size: number; className?: string; priority?: boolean }) {
  return <Image src={logo} alt="" width={size} height={size} priority={priority} className={cn("shrink-0", className)} />;
}
