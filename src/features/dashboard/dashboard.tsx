import {
  ArrowUpRight,
  Plus,
  Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const sampleProducts = [
  { name: "Tenis Adidas VL Court Base - ID3715", quantity: 2 },
  { name: "Zapatillas Adidas Grand Court Lifestyle", quantity: 2 },
  { name: "Adidas Tenis Court - GW6456", quantity: 2 },
  { name: "Adidas VL Court 3.0 - ID9062", quantity: 2 },
  { name: "Bota Escolar Audaz Niño - 433306", quantity: 2 },
  { name: "Bota Escolar Audaz Juvenil - 433308", quantity: 2 },
  { name: "Zapatillas Adidas Casual Tensaur Run 3.0", quantity: 2 },
  { name: "Botas Jeep 3561 Caballero", quantity: 1 },
];

const sampleSales = [
  {
    customer: "Jaime González Correa",
    order: "Orden #b1b5e057",
    status: "Enviado",
    amount: 99,
    date: "19 oct · 08:03",
  },
  {
    customer: "Santiago Perez Bagilvo",
    order: "Orden #05d2cbb",
    status: "Preparando",
    amount: 589,
    date: "18 oct · 17:25",
  },
  {
    customer: "Santiago Perez Bagilvo",
    order: "Orden #b173300",
    status: "Cancelado",
    amount: 1399,
    date: "17 oct · 16:25",
  },
  {
    customer: "Santiago Perez Bagilvo",
    order: "Orden #0f30737",
    status: "Preparando",
    amount: 1299,
    date: "17 oct · 09:56",
  },
  {
    customer: "Santiago Perez Bagilvo",
    order: "Orden #85415e",
    status: "Cancelado",
    amount: 1299,
    date: "17 oct · 08:52",
  },
];

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

function PreviewAction({
  children,
  icon,
}: {
  children: string;
  icon: "add" | "view";
}) {
  const Icon = icon === "add" ? Plus : ArrowUpRight;

  return (
    <Button
      type="button"
      size="sm"
      disabled
      className="pointer-events-none disabled:opacity-100"
    >
      <Icon data-icon="inline-start" />
      {children}
    </Button>
  );
}

function InventoryCard() {
  return (
    <Card className="h-full gap-0 rounded-lg ring-1 ring-foreground/10">
      <CardHeader className="grid-cols-[1fr_auto] items-center gap-2 pb-3">
        <CardTitle className="text-xs font-medium">
          Inventario de Productos
        </CardTitle>
        <Settings2 aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="text-lg font-semibold leading-none">128</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Productos en inventario
        </p>
        <p className="mt-1 text-[11px]">
          Valor: {currencyFormatter.format(190_192)}
        </p>
        <ul className="mt-3 space-y-2">
          {sampleProducts.map((product) => (
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
        <p className="mt-2 text-right text-[10px] text-muted-foreground">
          +68 productos más
        </p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <PreviewAction icon="add">Añadir</PreviewAction>
          <PreviewAction icon="view">Ver todos</PreviewAction>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentSalesCard() {
  return (
    <Card className="h-full gap-0 rounded-lg ring-1 ring-foreground/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Ventas Recientes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sampleSales.map((sale) => (
          <article
            key={sale.order}
            className="flex min-h-[58px] items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-[10px] font-medium">{sale.customer}</p>
              <p className="mt-1 truncate text-[9px] text-muted-foreground">
                {sale.order}
              </p>
              <Badge
                variant="outline"
                className="mt-1 h-auto border-0 px-0 py-0 text-[9px] font-normal text-muted-foreground"
              >
                Estado: {sale.status}
              </Badge>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-semibold text-green-700">
                {currencyFormatter.format(sale.amount)}
              </p>
              <p className="mt-1 text-[9px] text-muted-foreground">
                {sale.date}
              </p>
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}

function BestSellingProductsCard() {
  return (
    <Card className="h-full gap-0 rounded-lg ring-1 ring-foreground/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-medium">
          Productos Más Vendidos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex min-h-20 items-center justify-center text-center text-[10px] text-muted-foreground">
          No hay productos top para mostrar.
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  return (
    <section aria-labelledby="dashboard-title">
      <h1 id="dashboard-title" className="sr-only">
        Panel de inicio
      </h1>
      <div className="mb-4 flex items-center justify-end">
        <Badge variant="secondary" className="font-normal">
          Vista previa · datos de muestra
        </Badge>
      </div>
      <div className="grid items-start gap-3 lg:grid-cols-3">
        <InventoryCard />
        <RecentSalesCard />
        <BestSellingProductsCard />
      </div>
    </section>
  );
}
