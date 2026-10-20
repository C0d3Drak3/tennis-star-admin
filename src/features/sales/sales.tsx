"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ApiError,
  completeSale,
  createSale,
  getCustomers,
  getProducts,
  getSale,
  getSales,
  reactivateSale,
  updateSale,
  updateSaleOperations,
  updateSalePayment,
  type Customer,
  type Product,
  type Sale,
  type SaleFilters,
  type SaleHistoryEntry,
  type SaleInput,
  type SaleList,
  type SaleOrderStatus,
  type SalePaymentStatus,
} from "@/lib/api";

const PAGE_SIZE = 10;
type SortColumn = NonNullable<SaleFilters["sortBy"]>;
type Direction = NonNullable<SaleFilters["sortDirection"]>;

const EMPTY_LIST: SaleList = {
  items: [],
  total: 0,
  page: 1,
  pageSize: PAGE_SIZE,
  totalPages: 0,
};

const EMPTY_INPUT: SaleInput = {
  customerId: "",
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  paymentMethod: "CARD",
  paymentStatus: "PAID",
  shippingAddress: "",
  shippingCity: "",
  shippingPostalCode: "",
  carrier: "",
  trackingNumber: "",
  operationalNotes: "",
  items: [],
};

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Tu sesión no es válida. Inicia sesión nuevamente.";
    if (error.status < 500) return error.message;
  }
  return "No se pudo completar la operación. Comprueba la conexión e inténtalo nuevamente.";
}

function money(value: string | number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(Number(value));
}

function date(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function historyDescription(entry: SaleHistoryEntry): string {
  const changes = entry.changes;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const status = (value: unknown) =>
    value === "PREPARING" ? "En preparación" : value === "SHIPPED" ? "Enviado" : value === "CANCELLED" ? "Cancelado" : "";
  const payment = (value: unknown) => (value === "PAID" ? "Pagado" : value === "FAILED" ? "Fallido" : "");
  const previousStatus = status(changes.previousStatus);
  const nextStatus = status(changes.status);
  const previousPayment = payment(changes.previousPaymentStatus);
  const nextPayment = payment(changes.paymentStatus);

  switch (entry.event) {
    case "CREATED": {
      const orderNumber = text(changes.orderNumber);
      const total = text(changes.total);
      return `Orden creada${orderNumber ? ` · ${orderNumber}` : ""}${total ? ` · Total ${money(total)}` : ""}`;
    }
    case "PAYMENT_FAILED_CANCELLED":
      return "Pago fallido; orden cancelada";
    case "UPDATED": {
      const details: string[] = [];
      if (previousStatus && nextStatus && previousStatus !== nextStatus) details.push(`estado: ${previousStatus} → ${nextStatus}`);
      if (previousPayment && nextPayment && previousPayment !== nextPayment) details.push(`pago: ${previousPayment} → ${nextPayment}`);
      if (text(changes.previousTotal) && text(changes.total) && changes.previousTotal !== changes.total) {
        details.push(`total: ${money(text(changes.previousTotal))} → ${money(text(changes.total))}`);
      }
      const previousCustomer = changes.previousCustomer;
      const customer = changes.customer;
      if (JSON.stringify(previousCustomer) !== JSON.stringify(customer)) details.push("datos del cliente actualizados");
      if (JSON.stringify(changes.previousShipping) !== JSON.stringify(changes.shipping)) details.push("datos de envío actualizados");
      if (JSON.stringify(changes.previousItems) !== JSON.stringify(changes.items)) details.push("productos o cantidades actualizados");
      return details.length ? `Orden actualizada · ${details.join(" · ")}` : "Orden actualizada";
    }
    case "REACTIVATED":
      return "Orden reactivada y stock reservado";
    case "CANCELLED":
      return changes.stockReturned === true ? "Orden cancelada y stock devuelto" : "Orden cancelada";
    case "PAYMENT_UPDATED":
      return previousPayment && nextPayment
        ? `Pago actualizado: ${previousPayment} → ${nextPayment}`
        : "Estado del pago actualizado";
    case "SHIPPED":
      return "Orden enviada";
    case "OPERATIONS_UPDATED": {
      const details: string[] = [];
      if (changes.previousCarrier !== changes.carrier) details.push("transportista");
      if (changes.previousTrackingNumber !== changes.trackingNumber) details.push("número de seguimiento");
      if (changes.previousOperationalNotes !== changes.operationalNotes) details.push("notas operativas");
      return details.length ? `Datos operativos actualizados · ${details.join(", ")}` : "Datos operativos actualizados";
    }
    default:
      return "Modificación de la orden";
  }
}

function orderStatus(status: SaleOrderStatus): string {
  return status === "PREPARING"
    ? "En preparación"
    : status === "SHIPPED"
      ? "Enviado"
      : "Cancelado";
}

function statusClass(status: SaleOrderStatus): string {
  return status === "PREPARING"
    ? "bg-amber-100 text-amber-800"
    : status === "SHIPPED"
      ? "bg-emerald-100 text-emerald-800"
      : "bg-rose-100 text-rose-800";
}

function paymentText(status: SalePaymentStatus): string {
  return status === "PAID" ? "Pagado" : "Fallido";
}

function customerName(customer: Pick<Customer, "firstName" | "lastName">): string {
  return `${customer.firstName} ${customer.lastName}`.trim();
}

function saleCustomerName(sale: Sale): string {
  return [sale.customerFirstName, sale.customerLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function newForm(sale?: Sale): SaleInput {
  if (!sale) return { ...EMPTY_INPUT, items: [] };
  return {
    customerId: sale.customerId ?? "",
    customerName: saleCustomerName(sale),
    customerEmail: sale.customerEmail ?? "",
    customerPhone: sale.customerPhone ?? "",
    paymentMethod: sale.paymentMethod ?? "CARD",
    paymentStatus: sale.paymentStatus,
    shippingAddress: sale.shippingAddress ?? "",
    shippingCity: sale.shippingCity ?? "",
    shippingPostalCode: sale.shippingPostalCode ?? "",
    carrier: sale.carrier ?? "",
    trackingNumber: sale.trackingNumber ?? "",
    operationalNotes: sale.operationalNotes ?? "",
    items: sale.items.map((item) => ({
      productId: item.productId ?? "",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };
}

function SortButton({
  label,
  column,
  current,
  direction,
  onSort,
}: {
  label: string;
  column: SortColumn;
  current: SortColumn;
  direction: Direction;
  onSort: (column: SortColumn) => void;
}) {
  const active = current === column;
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      aria-sort={
        active ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
      className="px-3 py-3 text-left font-medium"
    >
      <button
        aria-label={`Ordenar por ${label}${active ? `, ${direction === "asc" ? "ascendente" : "descendente"}` : ""}`}
        className="inline-flex items-center gap-1.5 hover:text-foreground"
        onClick={() => onSort(column)}
        type="button"
      >
        {label}
        <Icon aria-hidden="true" className="size-3.5" />
      </button>
    </th>
  );
}

export function Sales() {
  const [list, setList] = useState(EMPTY_LIST);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | SaleOrderStatus>("");
  const [paymentFilter, setPaymentFilter] = useState<"" | SalePaymentStatus>("");
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>("createdAt");
  const [sortDirection, setSortDirection] = useState<Direction>("desc");
  const [refresh, setRefresh] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [reactivating, setReactivating] = useState(false);
  const [form, setForm] = useState<SaleInput>(EMPTY_INPUT);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [selected, setSelected] = useState<Sale | null>(null);
  const [managementNote, setManagementNote] = useState("");
  const [carrierDraft, setCarrierDraft] = useState("");
  const [trackingDraft, setTrackingDraft] = useState("");
  const [operationalNotesDraft, setOperationalNotesDraft] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void getSales({
      search: appliedSearch,
      status: statusFilter,
      paymentStatus: paymentFilter,
      page,
      pageSize: PAGE_SIZE,
      sortBy: sortColumn,
      sortDirection,
    })
      .then((result) => {
        if (!active) return;
        setList(result);
        if (result.totalPages > 0 && page > result.totalPages) {
          setPage(result.totalPages);
        }
      })
      .catch((requestError: unknown) => {
        if (active) setError(errorText(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appliedSearch, page, paymentFilter, refresh, sortColumn, sortDirection, statusFilter]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      getCustomers({ page: 1, pageSize: 100, sortBy: "lastName", sortDirection: "asc" }),
      getProducts({ page: 1, pageSize: 100, sortBy: "name", sortDirection: "asc" }),
    ])
      .then(([firstCustomers, firstProducts]) => {
        if (!active) return;
        const restCustomers = Array.from(
          { length: Math.max(firstCustomers.totalPages - 1, 0) },
          (_, index) =>
            getCustomers({
              page: index + 2,
              pageSize: 100,
              sortBy: "lastName",
              sortDirection: "asc",
            }),
        );
        const restProducts = Array.from(
          { length: Math.max(firstProducts.totalPages - 1, 0) },
          (_, index) =>
            getProducts({
              page: index + 2,
              pageSize: 100,
              sortBy: "name",
              sortDirection: "asc",
            }),
        );
        return Promise.all([Promise.all(restCustomers), Promise.all(restProducts)]).then(([customerPages, productPages]) => {
          if (!active) return;
          setCustomers([
            ...firstCustomers.items,
            ...customerPages.flatMap((result) => result.items),
          ]);
          setProducts([
            ...firstProducts.items,
            ...productPages.flatMap((result) => result.items),
          ]);
        });
      })
      .catch((requestError: unknown) => {
        if (active) setError(errorText(requestError));
      });
    return () => {
      active = false;
    };
  }, []);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  function resetForm() {
    setFormOpen(false);
    setEditing(null);
    setReactivating(false);
    setForm({ ...EMPTY_INPUT, items: [] });
    setIdempotencyKey("");
  }

  function openCreate() {
    setError("");
    setNotice("");
    setEditing(null);
    setReactivating(false);
    setForm(newForm());
    setIdempotencyKey(crypto.randomUUID());
    setFormOpen(true);
  }

  function openEdit(sale: Sale, reactivate = false) {
    setError("");
    setNotice("");
    setEditing(sale);
    setReactivating(reactivate);
    setForm(newForm(sale));
    setSelected(null);
    setFormOpen(true);
  }

  function patchForm(field: keyof SaleInput, value: SaleInput[keyof SaleInput]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setLine(index: number, field: "productId" | "quantity" | "unitPrice", value: string) {
    setForm((current) => ({
      ...current,
      items: current.items.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        if (field === "productId") {
          const product = productById.get(value);
          return {
            ...line,
            productId: value,
            unitPrice: product?.price ?? line.unitPrice ?? "0.00",
          };
        }
        if (field === "quantity") return { ...line, quantity: Number(value) };
        return { ...line, unitPrice: value };
      }),
    }));
  }

  const total = form.items.reduce((sum, line) => {
    const unitPrice = Number(line.unitPrice ?? productById.get(line.productId)?.price ?? 0);
    return sum + unitPrice * (Number(line.quantity) || 0);
  }, 0);

  function validateForm(): string | null {
    if (!editing && !form.customerId) return "Selecciona un cliente.";
    if (
      !form.customerName?.trim() ||
      !form.customerEmail?.trim() ||
      !form.customerPhone?.trim()
    ) {
      return "Completa los datos históricos del cliente.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail)) {
      return "Ingresa un email histórico válido.";
    }
    if (!form.shippingAddress.trim() || !form.shippingCity.trim() || !form.shippingPostalCode.trim()) {
      return "Completa dirección, ciudad y código postal de envío.";
    }
    if (form.items.length === 0) return "Agrega al menos un producto.";
    if (form.items.some((item) => !item.productId || !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
      return "Selecciona productos y cantidades enteras mayores que cero.";
    }
    if (
      editing &&
      form.items.some(
        (item) =>
          !item.unitPrice ||
          !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(item.unitPrice),
      )
    ) {
      return "Revisa los precios unitarios de los productos.";
    }
    return null;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const validation = validateForm();
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    try {
      const payload: SaleInput = {
        ...form,
        customerId: form.customerId || null,
        customerName: form.customerName?.trim(),
        customerEmail: form.customerEmail?.trim().toLowerCase(),
        customerPhone: form.customerPhone?.trim(),
        shippingAddress: form.shippingAddress.trim(),
        shippingCity: form.shippingCity.trim(),
        shippingPostalCode: form.shippingPostalCode.trim(),
        carrier: form.carrier?.trim() || null,
        trackingNumber: form.trackingNumber?.trim() || null,
        operationalNotes: form.operationalNotes?.trim() || null,
        items: form.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          ...(editing ? { unitPrice: item.unitPrice } : {}),
        })),
      };
      if (!editing) {
        await createSale(payload, idempotencyKey);
        setNotice("Orden creada.");
      } else if (reactivating) {
        await reactivateSale(editing.id, payload);
        setNotice("Orden reactivada y stock actualizado.");
      } else {
        await updateSale(editing.id, payload);
        setNotice(
          payload.paymentStatus === "FAILED"
            ? "Pago marcado como Fallido: la orden se canceló y se devolvió el stock."
            : "Orden actualizada.",
        );
      }
      resetForm();
      setSelected(null);
      setPage(1);
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function showDetails(sale: Sale) {
    setError("");
    try {
      const details = await getSale(sale.id);
      setSelected(details);
      setManagementNote("");
      setCarrierDraft(details.carrier ?? "");
      setTrackingDraft(details.trackingNumber ?? "");
      setOperationalNotesDraft(details.operationalNotes ?? "");
    } catch (requestError) {
      setError(errorText(requestError));
    }
  }

  async function perform(action: () => Promise<unknown>, successMessage: string) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
      setSelected(null);
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setError(errorText(requestError));
      if (selected) {
        try {
          setSelected(await getSale(selected.id));
        } catch (refreshError) {
          setError(errorText(refreshError));
        }
      }
    } finally {
      setSaving(false);
    }
  }

  function sort(column: SortColumn) {
    setLoading(true);
    setPage(1);
    if (column === sortColumn) {
      setSortDirection((value) => (value === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }

  const start = list.total ? (list.page - 1) * list.pageSize + 1 : 0;
  const end = Math.min(list.page * list.pageSize, list.total);

  return (
    <section aria-labelledby="sales-title" className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 id="sales-title" className="text-xl font-semibold tracking-tight">Ventas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administra pedidos, pagos, envíos e inventario.
          </p>
        </div>
        <Button onClick={openCreate} type="button">
          <Plus aria-hidden="true" data-icon="inline-start" />
          Nueva venta
        </Button>
      </div>

      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      {error && !formOpen && (
        <p role="alert" className="rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {formOpen && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>
                  {!editing ? "Nueva venta" : reactivating ? `Reactivar ${editing.orderNumber}` : `Editar ${editing.orderNumber}`}
                </CardTitle>
                <CardDescription className="mt-1">
                  {form.paymentStatus === "FAILED"
                    ? "El pago fallido dejará la orden cancelada y no consumirá stock."
                    : "El backend valida y reserva el stock transaccionalmente."}
                </CardDescription>
              </div>
              <Button aria-label="Cerrar formulario" disabled={saving} onClick={resetForm} size="icon-sm" type="button" variant="outline">
                <X aria-hidden="true" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={submit} noValidate>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Cliente</span>
                  <select className="h-9 w-full rounded-md border border-input bg-background px-3" onChange={(event) => {
                    const selectedCustomer = customers.find((item) => item.id === event.target.value);
                    setForm((current) => ({
                      ...current,
                      customerId: event.target.value,
                      ...(selectedCustomer ? {
                        customerName: customerName(selectedCustomer),
                        customerEmail: selectedCustomer.email,
                        customerPhone: selectedCustomer.phone,
                        shippingAddress: selectedCustomer.shippingAddress,
                        shippingCity: selectedCustomer.city,
                        shippingPostalCode: selectedCustomer.postalCode,
                      } : {}),
                    }));
                  }} value={form.customerId ?? ""}>
                    <option value="">{editing ? "Sin referencia viva (conservar snapshot)" : "Seleccionar cliente"}</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customerName(customer)} — {customer.email}
                      </option>
                    ))}
                  </select>
                </label>
                {([
                  ["customerName", "Nombre del cliente"],
                  ["customerEmail", "Email histórico"],
                  ["customerPhone", "Teléfono histórico"],
                ] as const).map(([field, label]) => (
                  <label className="space-y-1.5 text-sm" key={field}>
                    <span className="font-medium">{label}</span>
                    <input
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3"
                      maxLength={field === "customerEmail" ? 254 : field === "customerPhone" ? 40 : 200}
                      onChange={(event) => patchForm(field, event.target.value)}
                      required
                      type={field === "customerEmail" ? "email" : "text"}
                      value={form[field] ?? ""}
                    />
                  </label>
                ))}
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Método de pago</span>
                  <select className="h-9 w-full rounded-md border border-input bg-background px-3" onChange={(event) => patchForm("paymentMethod", event.target.value as SaleInput["paymentMethod"])} value={form.paymentMethod}>
                    <option value="CARD">Tarjeta</option>
                    <option value="CASH">Efectivo</option>
                  </select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Estado del pago</span>
                  <select className="h-9 w-full rounded-md border border-input bg-background px-3" onChange={(event) => patchForm("paymentStatus", event.target.value as SalePaymentStatus)} value={form.paymentStatus}>
                    <option value="PAID">Pagado</option>
                    <option value="FAILED">Fallido</option>
                  </select>
                </label>
                {([
                  ["shippingAddress", "Dirección de envío"],
                  ["shippingCity", "Ciudad"],
                  ["shippingPostalCode", "Código postal"],
                  ["carrier", "Transportista"],
                  ["trackingNumber", "Número de seguimiento"],
                ] as const).map(([field, label]) => (
                  <label className="space-y-1.5 text-sm" key={field}>
                    <span className="font-medium">{label}</span>
                    <input
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3"
                      maxLength={field === "shippingAddress" ? 200 : field === "shippingCity" ? 100 : 100}
                      onChange={(event) => patchForm(field, event.target.value)}
                      required={field.startsWith("shipping")}
                      value={form[field] ?? ""}
                    />
                  </label>
                ))}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Productos</h3>
                  <Button onClick={() => setForm((current) => ({ ...current, items: [...current.items, { productId: "", quantity: 1 }] }))} size="sm" type="button" variant="outline">
                    <Plus aria-hidden="true" data-icon="inline-start" /> Agregar producto
                  </Button>
                </div>
                {form.items.map((line, index) => {
                  const product = productById.get(line.productId);
                  const unitPrice = Number(line.unitPrice ?? product?.price ?? 0);
                  return (
                    <div className="grid items-end gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_100px_140px_120px_auto]" key={`${index}-${line.productId}`}>
                      <label className="space-y-1 text-sm">
                        <span>Producto</span>
                        <select className="h-9 w-full rounded-md border border-input bg-background px-2" onChange={(event) => setLine(index, "productId", event.target.value)} value={line.productId}>
                          <option value="">Seleccionar producto</option>
                          {line.productId && !product && <option value={line.productId}>Producto histórico eliminado — seleccionar reemplazo</option>}
                          {products.filter((item) => item.isActive || item.id === line.productId).map((item) => <option key={item.id} value={item.id}>{item.name}{item.isActive ? "" : " (inactivo)"} ({money(item.price)}) · stock {item.stock}</option>)}
                        </select>
                        {product && <span className="block text-xs text-muted-foreground">{product.description ?? "Sin descripción"}</span>}
                      </label>
                      <label className="space-y-1 text-sm">
                        <span>Cantidad</span>
                        <input className="h-9 w-full rounded-md border border-input bg-transparent px-2" min={1} onChange={(event) => setLine(index, "quantity", event.target.value)} type="number" value={line.quantity} />
                      </label>
                      {editing ? (
                        <label className="space-y-1 text-sm">
                          <span>Precio unitario</span>
                          <input className="h-9 w-full rounded-md border border-input bg-transparent px-2" min="0" onChange={(event) => setLine(index, "unitPrice", event.target.value)} step="0.01" type="number" value={line.unitPrice ?? ""} />
                        </label>
                      ) : (
                        <div className="space-y-1 text-sm"><span className="block">Precio unitario</span><span className="block h-9 pt-2">{product ? money(product.price) : "—"}</span></div>
                      )}
                      <div className="space-y-1 text-sm"><span className="block">Subtotal</span><span className="block h-9 pt-2 font-medium">{money(unitPrice * (Number(line.quantity) || 0))}</span></div>
                      <Button aria-label="Quitar producto" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} size="icon" type="button" variant="ghost"><X aria-hidden="true" /></Button>
                    </div>
                  );
                })}
                <div className="text-right text-base font-semibold">Total: {money(total)}</div>
              </div>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Notas operativas</span>
                <textarea className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2" maxLength={2_000} onChange={(event) => patchForm("operationalNotes", event.target.value)} value={form.operationalNotes ?? ""} />
              </label>
              {error && <p role="alert" className="rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button disabled={saving} type="submit">{saving ? "Guardando…" : !editing ? "Crear orden" : reactivating ? "Reactivar orden" : "Guardar cambios"}</Button>
                <Button disabled={saving} onClick={resetForm} type="button" variant="outline">Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>Órdenes</CardTitle>
              <CardDescription className="mt-1">Mostrando {start}–{end} de {list.total}</CardDescription>
            </div>
            <form className="flex min-w-60 flex-1 gap-2 sm:max-w-md" onSubmit={(event) => { event.preventDefault(); setPage(1); setAppliedSearch(search.trim()); }}>
              <div className="relative min-w-0 flex-1">
                <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input aria-label="Buscar ventas" className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente u orden" value={search} />
              </div>
              <Button aria-label="Buscar" size="icon" type="submit"><Search aria-hidden="true" /></Button>
            </form>
            <select aria-label="Filtrar estado de pedido" className="h-9 rounded-md border border-input bg-background px-2 text-sm" onChange={(event) => { setStatusFilter(event.target.value as "" | SaleOrderStatus); setPage(1); }} value={statusFilter}>
              <option value="">Todos los pedidos</option><option value="PREPARING">En preparación</option><option value="SHIPPED">Enviado</option><option value="CANCELLED">Cancelado</option>
            </select>
            <select aria-label="Filtrar estado de pago" className="h-9 rounded-md border border-input bg-background px-2 text-sm" onChange={(event) => { setPaymentFilter(event.target.value as "" | SalePaymentStatus); setPage(1); }} value={paymentFilter}>
              <option value="">Todos los pagos</option><option value="PAID">Pagado</option><option value="FAILED">Fallido</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && !formOpen && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <SortButton label="Cliente" column="customer" current={sortColumn} direction={sortDirection} onSort={sort} />
                  <SortButton label="Número de orden" column="orderNumber" current={sortColumn} direction={sortDirection} onSort={sort} />
                  <SortButton label="Estado" column="status" current={sortColumn} direction={sortDirection} onSort={sort} />
                  <SortButton label="Total" column="total" current={sortColumn} direction={sortDirection} onSort={sort} />
                  <SortButton label="Pago" column="payment" current={sortColumn} direction={sortDirection} onSort={sort} />
                  <th className="px-3 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={6}>Cargando órdenes…</td></tr>
                ) : list.items.length === 0 ? (
                  <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={6}>No se encontraron ventas.</td></tr>
                ) : list.items.map((sale) => (
                  <tr key={sale.id} className="hover:bg-muted/30">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                          {(saleCustomerName(sale) || "?").charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium">{saleCustomerName(sale) || "Cliente histórico"}</span>
                          <span className="block truncate text-xs text-muted-foreground">{sale.customerEmail ?? "Email no disponible"}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3"><span className="block font-medium">{sale.orderNumber}</span><span className="text-xs text-muted-foreground">{date(sale.createdAt)}</span></td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(sale.status)}`}>{orderStatus(sale.status)}</span></td>
                    <td className="px-3 py-3"><span className="block font-medium">{money(sale.total)}</span><span className="text-xs text-muted-foreground">{sale.paymentMethod === "CASH" ? "Efectivo" : sale.paymentMethod === "CARD" ? "Tarjeta" : "—"}</span></td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${sale.paymentStatus === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{paymentText(sale.paymentStatus)}</span></td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <Button aria-label={`Ver ${sale.orderNumber}`} onClick={() => void showDetails(sale)} size="icon-sm" type="button" variant="ghost"><Eye aria-hidden="true" className="text-blue-600" /></Button>
                        {sale.status !== "SHIPPED" && (
                          <Button aria-label={sale.status === "CANCELLED" ? `Reactivar ${sale.orderNumber}` : `Editar ${sale.orderNumber}`} onClick={() => openEdit(sale, sale.status === "CANCELLED")} size="icon-sm" type="button" variant="ghost">
                            {sale.status === "CANCELLED" ? <PackageCheck aria-hidden="true" /> : <Pencil aria-hidden="true" />}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t pt-3 text-sm">
            <span className="text-muted-foreground">Página {list.page} de {Math.max(list.totalPages, 1)}</span>
            <div className="flex gap-2">
              <Button aria-label="Página anterior" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} size="sm" type="button" variant="outline"><ChevronLeft aria-hidden="true" />Anterior</Button>
              <Button aria-label="Página siguiente" disabled={page >= list.totalPages || loading} onClick={() => setPage((value) => value + 1)} size="sm" type="button" variant="outline">Siguiente<ChevronRight aria-hidden="true" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <Card aria-labelledby="sale-details-title" aria-modal="true" className="my-3 w-full max-w-4xl" role="dialog">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle id="sale-details-title">Gestionar Orden</CardTitle>
                <Button aria-label="Cerrar detalles" onClick={() => setSelected(null)} size="icon-sm" type="button" variant="outline"><X aria-hidden="true" /></Button>
              </div>
              <CardDescription>{orderStatus(selected.status)} · Orden {selected.orderNumber}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 py-4">
              <section className="rounded-md border p-4">
                <h3 className="mb-2 text-sm font-semibold">Estado Actual</h3>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(selected.status)}`}>{orderStatus(selected.status)}</span>
                <span className="ml-2 text-sm text-muted-foreground">{selected.orderNumber} · {date(selected.createdAt)}</span>
              </section>
              <div className="grid gap-4 md:grid-cols-2">
                <section className="rounded-md border p-4">
                  <h3 className="mb-3 text-sm font-semibold">Información del Cliente</h3>
                  <p className="text-sm font-medium">{saleCustomerName(selected) || "—"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{selected.customerEmail ?? "Email no disponible"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{selected.customerPhone ?? "Teléfono no disponible"}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">ID: {selected.customerIdSnapshot ?? "—"}</p>
                </section>
                <section className="rounded-md border p-4">
                  <h3 className="mb-3 text-sm font-semibold">Información de Pago</h3>
                  <p className="text-sm">Método: {selected.paymentMethod === "CASH" ? "Efectivo" : selected.paymentMethod === "CARD" ? "Tarjeta" : "No registrado"}</p>
                  <p className="mt-1 text-sm">Estado: <strong>{paymentText(selected.paymentStatus)}</strong></p>
                  <p className="mt-1 text-sm">Total: <strong>{money(selected.total)}</strong></p>
                </section>
              </div>
              <section className="rounded-md border p-4">
                <h3 className="mb-3 text-sm font-semibold">Productos de la orden</h3>
                <div className="space-y-3">
                  {selected.items.map((item) => (
                    <div className="flex flex-col justify-between gap-2 border-b pb-2 text-sm sm:flex-row" key={item.id}>
                      <div>
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{[item.brandName, item.categoryName, item.subcategoryName].filter(Boolean).join(" · ")}</p>
                        {item.productDescription && <p className="mt-1 text-xs text-muted-foreground">{item.productDescription}</p>}
                      </div>
                      <p className="shrink-0 text-sm">{item.quantity} × {money(item.unitPrice)} = <strong>{money(item.subtotal)}</strong></p>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-md border p-4">
                <div className="mb-3 flex items-center gap-2"><Truck aria-hidden="true" className="size-4" /><h3 className="text-sm font-semibold">Información de Envío</h3></div>
                <p className="text-sm">{selected.shippingAddress ?? "Dirección no registrada"}</p>
                <p className="text-sm text-muted-foreground">{[selected.shippingCity, selected.shippingPostalCode].filter(Boolean).join(", ")}</p>
                {selected.status === "SHIPPED" ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm"><span>Transportista</span><input className="h-9 w-full rounded-md border border-input bg-transparent px-3" maxLength={100} onChange={(event) => setCarrierDraft(event.target.value)} value={carrierDraft} /></label>
                    <label className="space-y-1 text-sm"><span>Número de seguimiento</span><input className="h-9 w-full rounded-md border border-input bg-transparent px-3" maxLength={100} onChange={(event) => setTrackingDraft(event.target.value)} value={trackingDraft} /></label>
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-sm">Transportista: {selected.carrier || "No asignado"}</p>
                    <p className="text-sm">Seguimiento: {selected.trackingNumber || "No disponible"}</p>
                  </>
                )}
              </section>
              <section className="rounded-md border p-4">
                <h3 className="mb-3 text-sm font-semibold">Historial de Modificaciones</h3>
                <div className="max-h-56 space-y-3 overflow-y-auto">
                  {(selected.history ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin modificaciones registradas.</p>
                  ) : selected.history?.map((entry) => (
                    <div className="border-l-2 border-secondary pl-3" key={entry.id}>
                      <p className="text-sm font-medium">{historyDescription(entry)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{date(entry.createdAt)}</p>
                      <p className="text-xs text-muted-foreground">Por: {entry.actorEmail}</p>
                      {entry.note && <p className="mt-1 text-sm">{entry.note}</p>}
                    </div>
                  ))}
                </div>
              </section>
              {(selected.status === "PREPARING" || selected.status === "SHIPPED") && (
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Notas operativas</span>
                  <textarea className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2" maxLength={2_000} onChange={(event) => setOperationalNotesDraft(event.target.value)} value={operationalNotesDraft} />
                </label>
              )}
              {selected.status !== "CANCELLED" && (
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Notas para la modificación (opcional)</span>
                  <textarea className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2" maxLength={2_000} onChange={(event) => setManagementNote(event.target.value)} placeholder="Agregar notas sobre el cambio de estado…" value={managementNote} />
                </label>
              )}
              <div className="flex flex-wrap gap-2 border-t pt-4">
                {selected.status === "PREPARING" && (
                  <>
                    {selected.paymentStatus === "PAID" && (
                      <>
                        <Button disabled={saving} onClick={() => void perform(() => completeSale(selected.id, { carrier: carrierDraft.trim() || null, trackingNumber: trackingDraft.trim() || null, operationalNotes: operationalNotesDraft.trim() || null, note: managementNote.trim() || null }), "Orden enviada.")} type="button">
                          <PackageCheck aria-hidden="true" data-icon="inline-start" />Completar Pedido
                        </Button>
                        <Button disabled={saving} onClick={() => void perform(() => updateSalePayment(selected.id, "FAILED", managementNote), "Pago fallido: orden cancelada y stock devuelto.")} type="button" variant="outline">Marcar pago Fallido</Button>
                      </>
                    )}
                  </>
                )}
                {selected.status === "CANCELLED" && (
                  selected.paymentStatus === "PAID" && (
                    <Button disabled={saving} onClick={() => openEdit(selected, true)} type="button"><PackageCheck aria-hidden="true" data-icon="inline-start" />Reactivar orden</Button>
                  )
                )}
                {selected.status === "SHIPPED" && <p className="w-full text-xs text-muted-foreground">Las órdenes enviadas no pueden cancelarse ni editar sus productos, importes o pago.</p>}
                {selected.status === "SHIPPED" && (
                  <Button disabled={saving} onClick={() => void perform(() => updateSaleOperations(selected.id, { carrier: carrierDraft.trim() || null, trackingNumber: trackingDraft.trim() || null, operationalNotes: operationalNotesDraft.trim() || null, note: managementNote.trim() || null }), "Datos operativos actualizados.")} type="button">
                    Guardar datos operativos
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
