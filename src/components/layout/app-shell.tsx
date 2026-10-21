import { Palmtree } from "lucide-react";
import { MobileNav } from "./mobile-nav";
import { SidebarContent, type SidebarUser } from "./sidebar-content";

/** Estructura común: sidebar fija en escritorio, cabecera con menú desplegable en tablet/móvil. */
export function AppShell({ user, children }: { user: SidebarUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Saltar al contenido
      </a>
      <aside className="sticky top-0 hidden h-screen lg:block">
        <SidebarContent user={user} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 lg:hidden">
          <MobileNav user={user} />
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Palmtree className="size-4 text-primary" />
            Vacaciones
          </span>
        </header>
        <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
