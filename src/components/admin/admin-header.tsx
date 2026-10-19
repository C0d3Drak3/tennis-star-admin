"use client";

import { Bell, ChevronLeft, LogOut, Sun, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/api";

export function AdminHeader() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setError("");
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
      router.refresh();
    } catch {
      setError("No se pudo cerrar la sesión. Inténtalo nuevamente.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-4 sm:px-6">
      <div className="flex items-center gap-5 text-xs">
        <ChevronLeft
          aria-hidden="true"
          className="size-3.5 text-muted-foreground"
        />
        <span className="font-medium">Inicio</span>
      </div>
      <div className="flex items-center gap-3 text-muted-foreground">
        <Bell aria-label="Notificaciones" className="size-3.5" />
        <Sun aria-label="Apariencia" className="size-3.5" />
        <span
          aria-label="Perfil de usuario"
          className="flex size-6 items-center justify-center rounded-full bg-secondary text-foreground"
        >
          <UserRound aria-hidden="true" className="size-3.5" />
        </span>
        <Button
          className="text-foreground"
          disabled={isLoggingOut}
          onClick={handleLogout}
          size="sm"
          type="button"
          variant="outline"
        >
          <LogOut aria-hidden="true" />
          <span className="hidden sm:inline">
            {isLoggingOut ? "Saliendo…" : "Cerrar sesión"}
          </span>
          <span className="sr-only sm:hidden">Cerrar sesión</span>
        </Button>
        {error && (
          <span role="alert" className="text-xs text-destructive">
            {error}
          </span>
        )}
      </div>
    </header>
  );
}
