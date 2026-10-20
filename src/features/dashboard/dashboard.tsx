"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Plus,
  Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ApiError,
  getDashboardSummary,
  type DashboardSummary,
  type SaleOrderStatus,
} from "@/lib/api";
import { ProductForm } from "@/features/products/product-form";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});
const integerFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 0,
});
const currencyParts = currencyFormatter.formatToParts(0);
const integerPartIndex = currencyParts.findIndex((part) => part.type === "integer");
const decimalSeparator = currencyParts.find((part) => part.type === "decimal")?.value ?? ",";
const currencyPrefix = currencyParts
  .slice(0, integerPartIndex)
  .map((part) => part.value)
  .join("");
const currencySuffix = currencyParts
  .slice(integerPartIndex + 1)
  .filter((part) => part.type !== "decimal" && part.type !== "fraction")
  .map((part) => part.value)
  .join("");

function formatCurrency(value: string): string {
  const [whole, fraction = ""] = value.split(".");
  return `${currencyPrefix}${integerFormatter.format(BigInt(whole))}${decimalSeparator}${fraction.padEnd(2, "0").slice(0, 2)}${currencySuffix}`;
}

function orderStatus(status: SaleOrderStatus): string {
  return status === "PREPARING"
    ? "En preparación"
    : status === "SHIPPED"
      ? "Enviado"
      : "Cancelado";
}

function formattedDate(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function PreviewAction({
  children,
  onClick,
  buttonRef,
}: {
  children: string;
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <Button
      type="button"
      size="sm"
      onClick={onClick}
      ref={buttonRef}
    >
      <Plus data-icon="inline-start" />
      {children}
    </Button>
  );
}

function InventoryCard({
  summary,
  loading,
  onAddProduct,
  addButtonRef,
}: {
  summary: DashboardSummary["inventory"] | null;
  loading: boolean;
  onAddProduct: () => void;
  addButtonRef: Ref<HTMLButtonElement>;
}) {
  const remainingProducts = summary
    ? Math.max(summary.productCount - summary.products.length, 0)
    : 0;

  return (
    <Card className="h-full gap-0 rounded-lg ring-1 ring-foreground/10">
      <CardHeader className="grid-cols-[1fr_auto] items-center gap-2 pb-3">
        <CardTitle className="text-xs font-medium">
          Inventario de Productos
        </CardTitle>
        <Settings2 aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="text-lg font-semibold leading-none">
          {loading ? "Cargando…" : summary?.productCount ?? "—"}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Productos en inventario
        </p>
        <p className="mt-1 text-[11px]">
          Valor: {summary ? formatCurrency(summary.value) : "—"}
        </p>
        <ul className="mt-3 space-y-2">
          {summary?.products.map((product) => (
            <li
              key={product.id}
              className="flex items-start justify-between gap-3 text-[10px] leading-snug"
            >
              <span className="min-w-0">{product.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {product.stock} uds.
              </span>
            </li>
          ))}
        </ul>
        {!loading && summary && summary.products.length === 0 && (
          <p className="mt-3 text-[10px] text-muted-foreground">
            No hay productos con stock disponible.
          </p>
        )}
        {!loading && summary && remainingProducts > 0 && (
          <p className="mt-2 text-right text-[10px] text-muted-foreground">
            +{remainingProducts} productos más
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-3">
          <PreviewAction onClick={onAddProduct} buttonRef={addButtonRef}>Añadir</PreviewAction>
          <Link
            href="/products"
            className={buttonVariants({ size: "sm", className: "inline-flex" })}
          >
            <ArrowUpRight aria-hidden="true" data-icon="inline-start" />
            Ver todos
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentSalesCard({
  orders,
  loading,
}: {
  orders: DashboardSummary["recentOrders"] | null;
  loading: boolean;
}) {
  return (
    <Card className="h-full gap-0 rounded-lg ring-1 ring-foreground/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Ventas Recientes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="py-6 text-center text-[10px] text-muted-foreground">
            Cargando órdenes…
          </p>
        ) : orders?.length ? (
          orders.map((sale) => {
            const confirmed = sale.status !== "CANCELLED" && sale.paymentStatus === "PAID";
            return (
              <article
                key={sale.orderNumber}
                className="flex min-h-[58px] items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-medium">{sale.customerName}</p>
                  <p className="mt-1 truncate text-[9px] text-muted-foreground">
                    Orden {sale.orderNumber}
                  </p>
                  <Badge
                    variant="outline"
                    className="mt-1 h-auto border-0 px-0 py-0 text-[9px] font-normal text-muted-foreground"
                  >
                    Estado: {orderStatus(sale.status)}
                    {sale.paymentStatus === "FAILED" ? " · Pago fallido" : ""}
                  </Badge>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-[10px] font-semibold ${
                      confirmed ? "text-green-700" : "text-muted-foreground"
                    }`}
                  >
                    {formatCurrency(sale.total)}
                  </p>
                  <p className="mt-1 text-[9px] text-muted-foreground">
                    {formattedDate(sale.createdAt)}
                  </p>
                </div>
              </article>
            );
          })
        ) : (
          <p className="py-6 text-center text-[10px] text-muted-foreground">
            No hay órdenes recientes para mostrar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function BestSellingProductsCard({
  products,
  loading,
}: {
  products: DashboardSummary["topProducts"] | null;
  loading: boolean;
}) {
  return (
    <Card className="h-full gap-0 rounded-lg ring-1 ring-foreground/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-medium">
          Productos Más Vendidos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex min-h-20 items-center justify-center text-center text-[10px] text-muted-foreground">
            Cargando productos…
          </div>
        ) : products?.length ? (
          <ul className="space-y-2">
            {products.map((product) => (
              <li
                key={product.name}
                className="flex items-start justify-between gap-3 text-[10px] leading-snug"
              >
                <span className="min-w-0">{product.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {product.quantity} uds.
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex min-h-20 items-center justify-center text-center text-[10px] text-muted-foreground">
            No hay productos vendidos en órdenes confirmadas.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const formSavingRef = useRef(false);
  const addProductButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void getDashboardSummary()
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(
          requestError instanceof ApiError && requestError.status < 500
            ? requestError.message
            : "No se pudo cargar el Dashboard. Comprueba la conexión e inténtalo nuevamente.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!createProductOpen) return;
    const dialog = dialogRef.current;
    const addProductButton = addProductButtonRef.current;
    dialog
      ?.querySelector<HTMLElement>(
        "input:not(:disabled), select:not(:disabled), button:not(:disabled)",
      )
      ?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !formSavingRef.current) {
        setCreateProductOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      addProductButton?.focus();
    };
  }, [createProductOpen]);

  function handleProductCreated() {
    setCreateProductOpen(false);
    setLoading(true);
    setError("");
    setRefreshKey((current) => current + 1);
  }

  return (
    <section aria-labelledby="dashboard-title">
      <h1 id="dashboard-title" className="sr-only">
        Panel de inicio
      </h1>
      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid items-start gap-3 lg:grid-cols-3">
        <InventoryCard
          summary={summary?.inventory ?? null}
          loading={loading}
          onAddProduct={() => setCreateProductOpen(true)}
          addButtonRef={addProductButtonRef}
        />
        <RecentSalesCard orders={summary?.recentOrders ?? null} loading={loading} />
        <BestSellingProductsCard products={summary?.topProducts ?? null} loading={loading} />
      </div>
      {createProductOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !formSavingRef.current) {
              setCreateProductOpen(false);
            }
          }}
        >
          <div
            aria-labelledby="dashboard-create-product-title"
            aria-modal="true"
            className="my-3 w-full max-w-4xl"
            ref={dialogRef}
            role="dialog"
          >
            <div className="sr-only" id="dashboard-create-product-title">
              Nuevo producto
            </div>
            <ProductForm
              onClose={() => {
                if (!formSavingRef.current) setCreateProductOpen(false);
              }}
              onSaved={handleProductCreated}
              onSavingChange={(saving) => {
                formSavingRef.current = saving;
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
