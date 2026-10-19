import {
  BadgePercent,
  Bell,
  CircleHelp,
  Gift,
  House,
  Layers3,
  Package,
  Settings,
  Shield,
  ShoppingCart,
  Tags,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

const navigationItems: { label: string; icon: LucideIcon }[] = [
  { label: "Inicio", icon: House },
  { label: "Ventas", icon: ShoppingCart },
  { label: "Categorías", icon: Tags },
  { label: "Marcas", icon: Layers3 },
  { label: "Productos", icon: Package },
  { label: "Clientes", icon: Users },
  { label: "Estadísticas", icon: Warehouse },
  { label: "Descuentos", icon: BadgePercent },
  { label: "Puntos de Lealtad", icon: Gift },
  { label: "Membresías", icon: Shield },
  { label: "Notificaciones", icon: Bell },
  { label: "Configuración", icon: Settings },
  { label: "Ayuda", icon: CircleHelp },
];

export function AdminSidebar({
  activeLabel = "Inicio",
}: {
  activeLabel?: string;
}) {
  return (
    <aside className="border-b border-border bg-background md:min-h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r">
      <div className="flex h-14 items-center border-b border-border px-5">
        <span className="text-sm font-semibold tracking-tight">Tennis Star</span>
      </div>
      <nav aria-label="Navegación principal" className="p-3">
        <ul className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
          {navigationItems.map(({ label, icon: Icon }) => {
            const isCurrentPage = label === activeLabel;
            const href =
              label === "Inicio"
                ? "/"
                : label === "Categorías"
                  ? "/categories"
                  : label === "Productos"
                    ? "/products"
                  : null;

            return (
              <li
                key={label}
                className={`flex shrink-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-xs ${
                  isCurrentPage
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {href ? (
                  <Link
                    href={href}
                    aria-current={isCurrentPage ? "page" : undefined}
                    className="flex w-full items-center gap-2.5"
                  >
                    <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                    <span>{label}</span>
                  </Link>
                ) : (
                  <>
                    <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                    <span>{label}</span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
