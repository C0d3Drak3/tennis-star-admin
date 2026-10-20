"use client";

import { Bell, ChevronLeft, LogOut, Sun, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/api";

const NAVIGATION_HISTORY_KEY = "tennis-star-admin:navigation-history";
const ADMIN_PATHS = ["/", "/categories", "/brands", "/products", "/customers", "/sales"];

type NavigationHistory = {
  currentPath: string;
  previousPaths: string[];
  pendingTarget: string | null;
};

function isAdminPath(path: string): boolean {
  return ADMIN_PATHS.some(
    (adminPath) =>
      path === adminPath || (adminPath !== "/" && path.startsWith(`${adminPath}/`)),
  );
}

function readNavigationHistory(): NavigationHistory | null {
  const serialized = window.sessionStorage.getItem(NAVIGATION_HISTORY_KEY);
  if (!serialized) return null;
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "currentPath" in parsed &&
      typeof parsed.currentPath === "string" &&
      "previousPaths" in parsed &&
      Array.isArray(parsed.previousPaths) &&
      parsed.previousPaths.every((path) => typeof path === "string") &&
      "pendingTarget" in parsed &&
      (typeof parsed.pendingTarget === "string" || parsed.pendingTarget === null)
    ) {
      return {
        currentPath: parsed.currentPath,
        previousPaths: parsed.previousPaths.filter(isAdminPath),
        pendingTarget: parsed.pendingTarget,
      };
    }
  } catch {
    return null;
  }
  return null;
}

function saveNavigationHistory(history: NavigationHistory): void {
  window.sessionStorage.setItem(NAVIGATION_HISTORY_KEY, JSON.stringify(history));
}

const routeLabels: Record<string, string> = {
  categories: "Categorías",
  brands: "Marcas",
  products: "Productos",
  customers: "Clientes",
  sales: "Ventas",
};

function routeLabel(segment: string): string {
  return (
    routeLabels[segment] ??
    segment
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export function AdminHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [navigatingBackFrom, setNavigatingBackFrom] = useState<string | null>(null);
  const isNavigatingBack = navigatingBackFrom === pathname;
  const [error, setError] = useState("");

  useEffect(() => {
    const history = readNavigationHistory();
    if (!history) {
      saveNavigationHistory({
        currentPath: pathname,
        previousPaths: [],
        pendingTarget: null,
      });
      return;
    }
    if (history.pendingTarget === pathname) {
      saveNavigationHistory({
        ...history,
        currentPath: pathname,
        pendingTarget: null,
      });
      return;
    }
    if (history.currentPath !== pathname) {
      const previousPaths = isAdminPath(history.currentPath)
        ? [...history.previousPaths, history.currentPath]
        : history.previousPaths;
      saveNavigationHistory({
        currentPath: pathname,
        previousPaths,
        pendingTarget: null,
      });
    }
  }, [pathname]);

  const breadcrumbs = pathname
    .split("/")
    .filter(Boolean)
    .map(routeLabel);

  function handleBack() {
    if (isNavigatingBack) return;
    const history = readNavigationHistory();
    const previousPaths = history?.previousPaths ?? [];
    let previousPath: string | undefined;
    while (previousPaths.length > 0) {
      const candidate = previousPaths.pop();
      if (candidate && isAdminPath(candidate) && candidate !== pathname) {
        previousPath = candidate;
        break;
      }
    }
    if (previousPath) {
      setNavigatingBackFrom(pathname);
      saveNavigationHistory({
        currentPath: pathname,
        previousPaths,
        pendingTarget: previousPath,
      });
      router.back();
      return;
    }
    if (pathname === "/") return;
    setNavigatingBackFrom(pathname);
    saveNavigationHistory({
      currentPath: pathname,
      previousPaths: [],
      pendingTarget: "/",
    });
    router.replace("/");
  }

  async function handleLogout() {
    setError("");
    setIsLoggingOut(true);
    try {
      await logout();
      window.sessionStorage.removeItem(NAVIGATION_HISTORY_KEY);
      router.replace("/login");
      router.refresh();
    } catch {
      setError("No se pudo cerrar la sesión. Inténtalo nuevamente.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="flex min-h-14 items-center justify-between gap-3 border-b border-white/15 bg-[#292929] px-4 text-white sm:px-6">
      <div className="flex min-w-0 items-center gap-3 text-xs text-white sm:gap-5">
        <Button
          aria-label="Volver a la página anterior"
          className="shrink-0 text-white hover:bg-white/10 hover:text-white"
          disabled={isNavigatingBack}
          onClick={handleBack}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ChevronLeft aria-hidden="true" className="size-3.5" />
        </Button>
        <nav aria-label="Ruta actual" className="min-w-0 truncate font-medium">
          <span>Inicio</span>
          {breadcrumbs.map((label, index) => (
            <span key={`${label}-${index}`}>
              <span aria-hidden="true" className="mx-2 text-white/60">/</span>
              <span>{label}</span>
            </span>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3 text-white/80">
        <Bell aria-label="Notificaciones" className="size-3.5" />
        <Sun aria-label="Apariencia" className="size-3.5" />
        <span
          aria-label="Perfil de usuario"
          className="flex size-6 items-center justify-center rounded-full bg-white/15 text-white"
        >
          <UserRound aria-hidden="true" className="size-3.5" />
        </span>
        <Button
          className="border-white/30 bg-transparent text-white transition-colors hover:bg-white/10 hover:text-red-400 focus-visible:ring-2 focus-visible:ring-white/70"
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
