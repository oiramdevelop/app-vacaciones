"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Palmtree } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { logoutAction } from "@/features/auth/actions";
import { isActive, NAV_ITEMS, type AppRole } from "@/features/navigation/nav-items";

export interface SidebarUser {
  name: string;
  email: string;
  role: AppRole;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function SidebarContent({ user, onNavigate }: { user: SidebarUser; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = NAV_ITEMS[user.role];

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Palmtree className="size-4" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Vacaciones</p>
          <p className="text-xs text-sidebar-muted">{user.role === "ADMIN" ? "Administración" : "Portal del empleado"}</p>
        </div>
      </div>

      <nav aria-label="Navegación principal" className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <Avatar>
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-sidebar-muted">{user.email}</p>
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="size-4" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
