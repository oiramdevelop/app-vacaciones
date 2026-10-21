import {
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  History,
  LayoutDashboard,
  ListChecks,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { AppRole } from "@/features/auth/access";

export type { AppRole };

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Si es true, sólo se marca activo con coincidencia exacta de ruta. */
  exact?: boolean;
}

export const NAV_ITEMS: Record<AppRole, NavItem[]> = {
  EMPLOYEE: [
    { label: "Inicio", href: "/dashboard", icon: LayoutDashboard, exact: true },
    { label: "Solicitar vacaciones", href: "/vacaciones/solicitar", icon: CalendarPlus },
    { label: "Mis solicitudes", href: "/vacaciones/mis-solicitudes", icon: ListChecks },
    { label: "Calendario del equipo", href: "/calendario", icon: CalendarDays },
  ],
  ADMIN: [
    { label: "Panel", href: "/admin", icon: LayoutDashboard, exact: true },
    { label: "Empleados", href: "/admin/empleados", icon: Users },
    { label: "Solicitudes", href: "/admin/solicitudes", icon: ClipboardCheck },
    { label: "Calendario global", href: "/admin/calendario", icon: CalendarDays },
    { label: "Configuración", href: "/admin/configuracion", icon: Settings },
    { label: "Historial", href: "/admin/historial", icon: History },
  ],
};

export function isActive(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
