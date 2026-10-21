"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarContent, type SidebarUser } from "./sidebar-content";

export function MobileNav({ user }: { user: SidebarUser }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Abrir menú">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
        <SheetDescription className="sr-only">Accesos a las secciones de la aplicación</SheetDescription>
        <SidebarContent user={user} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
