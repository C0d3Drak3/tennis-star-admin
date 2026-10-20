"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
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
  createCustomer,
  deleteCustomer,
  getCustomer,
  getCustomers,
  updateCustomer,
  type Customer,
  type CustomerFilters,
  type CustomerInput,
  type CustomerList,
} from "@/lib/api";

const PAGE_SIZE = 10;
const FIELD_LIMITS = {
  firstName: 100,
  lastName: 100,
  email: 254,
  phone: 40,
  shippingAddress: 200,
  city: 100,
  postalCode: 20,
} as const;
type SortColumn = NonNullable<CustomerFilters["sortBy"]>;
type SortDirection = NonNullable<CustomerFilters["sortDirection"]>;
type CustomerFormValues = CustomerInput;

const EMPTY_LIST: CustomerList = {
  items: [],
  total: 0,
  page: 1,
  pageSize: PAGE_SIZE,
  totalPages: 0,
};

const EMPTY_FORM: CustomerFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  shippingAddress: "",
  city: "",
  postalCode: "",
};

const FORM_FIELDS: {
  key: keyof CustomerFormValues;
  label: string;
  type?: "email" | "tel";
}[] = [
  { key: "firstName", label: "Nombre" },
  { key: "lastName", label: "Apellido" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Teléfono", type: "tel" },
  { key: "shippingAddress", label: "Dirección de envío" },
  { key: "city", label: "Ciudad" },
  { key: "postalCode", label: "Código postal" },
];

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Tu sesión no es válida. Inicia sesión nuevamente.";
    }
    if ([400, 404, 409].includes(error.status)) {
      return error.message;
    }
  }
  return "No se pudo completar la operación. Comprueba la conexión e inténtalo nuevamente.";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function Customers() {
  const [customerList, setCustomerList] = useState(EMPTY_LIST);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [expandedCustomer, setExpandedCustomer] = useState<Customer | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>("firstName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState<CustomerFormValues>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const detailsDialogRef = useRef<HTMLDivElement>(null);
  const detailsTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let active = true;
    void getCustomers({
      search: appliedSearch,
      page,
      pageSize: PAGE_SIZE,
      sortBy: sortColumn,
      sortDirection,
    })
      .then((result) => {
        if (active) {
          setCustomerList(result);
          if (result.totalPages > 0 && page > result.totalPages) {
            setPage(result.totalPages);
          }
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(getErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [appliedSearch, page, refreshKey, sortColumn, sortDirection]);

  useEffect(() => {
    if (!expandedCustomer) return;
    const dialog = detailsDialogRef.current;
    dialog?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setExpandedCustomer(null);
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
      detailsTriggerRef.current?.focus();
      detailsTriggerRef.current = null;
    };
  }, [expandedCustomer]);

  function resetForm() {
    setEditingCustomer(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(false);
  }

  function openNewCustomerForm() {
    resetForm();
    setError("");
    setNotice("");
    setIsFormOpen(true);
  }

  function startEditing(customer: Customer) {
    setEditingCustomer(customer);
    setForm({
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      shippingAddress: customer.shippingAddress,
      city: customer.city,
      postalCode: customer.postalCode,
    });
    setError("");
    setNotice("");
    setIsFormOpen(true);
  }

  function closeForm() {
    resetForm();
    setError("");
  }

  function updateFormValue(
    field: keyof CustomerFormValues,
    value: string,
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validateForm(): CustomerInput | null {
    const normalized: CustomerInput = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      shippingAddress: form.shippingAddress.trim(),
      city: form.city.trim(),
      postalCode: form.postalCode.trim(),
    };
    for (const { key, label } of FORM_FIELDS) {
      const value = normalized[key] ?? "";
      if (!value) {
        setError(`${label} es obligatorio.`);
        return null;
      }
      if (value.length > FIELD_LIMITS[key]) {
        setError(`${label} no puede superar ${FIELD_LIMITS[key]} caracteres.`);
        return null;
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email ?? "")) {
      setError("Ingresa un email válido.");
      return null;
    }
    normalized.email = normalized.email?.toLowerCase();
    return normalized;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const input = validateForm();
    if (!input) {
      return;
    }

    setIsSaving(true);
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, input);
        setNotice("Cliente actualizado.");
      } else {
        await createCustomer(input);
        setNotice("Cliente creado.");
      }
      resetForm();
      setIsLoading(true);
      setPage(1);
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleDetails(customer: Customer) {
    setError("");
    try {
      const details = await getCustomer(customer.id);
      setExpandedCustomer(details);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function confirmDelete(customer: Customer) {
    setError("");
    setNotice("");
    setBusyId(customer.id);
    try {
      await deleteCustomer(customer.id);
      setPendingDeleteId(null);
      setNotice("Cliente eliminado.");
      setIsLoading(true);
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyId(null);
    }
  }

  function toggleSort(column: SortColumn) {
    setIsLoading(true);
    setError("");
    setPage(1);
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }

  function renderSortHeader(label: string, column: SortColumn) {
    const active = sortColumn === column;
    const Icon = !active
      ? ArrowUpDown
      : sortDirection === "asc"
        ? ArrowUp
        : ArrowDown;
    return (
      <th
        aria-sort={
          active
            ? sortDirection === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
        className="px-3 py-2 font-medium"
      >
        <button
          aria-label={`Ordenar por ${label}${
            active
              ? sortDirection === "asc"
                ? ", ascendente"
                : ", descendente"
              : ""
          }`}
          className="inline-flex items-center gap-1.5 hover:text-foreground"
          onClick={() => toggleSort(column)}
          type="button"
        >
          {label}
          <Icon aria-hidden="true" className="size-3.5" />
        </button>
      </th>
    );
  }

  const firstResult =
    customerList.total === 0
      ? 0
      : (customerList.page - 1) * customerList.pageSize + 1;
  const lastResult = Math.min(
    customerList.page * customerList.pageSize,
    customerList.total,
  );

  return (
    <section aria-labelledby="customers-title" className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            id="customers-title"
            className="text-xl font-semibold tracking-tight"
          >
            Clientes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administra los datos de contacto y envío de tus clientes.
          </p>
        </div>
        <Button onClick={openNewCustomerForm} type="button">
          <Plus aria-hidden="true" data-icon="inline-start" />
          Nuevo cliente
        </Button>
      </div>

      {isFormOpen && (
        <Card className="rounded-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <CardTitle>
                  {editingCustomer ? "Editar cliente" : "Nuevo cliente"}
                </CardTitle>
                <CardDescription>
                  Todos los datos de contacto y envío son obligatorios.
                </CardDescription>
              </div>
              <Button
                aria-label="Cerrar formulario"
                disabled={isSaving}
                onClick={closeForm}
                size="icon-sm"
                type="button"
                variant="outline"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              onSubmit={handleSave}
              noValidate
            >
              {FORM_FIELDS.map(({ key, label, type }) => (
                <div className="space-y-1.5" key={key}>
                  <label
                    className="text-sm font-medium"
                    htmlFor={`customer-${key}`}
                  >
                    {label}
                  </label>
                  <input
                    autoComplete="off"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    disabled={isSaving}
                    id={`customer-${key}`}
                    maxLength={FIELD_LIMITS[key]}
                    onChange={(event) =>
                      updateFormValue(key, event.target.value)
                    }
                    required
                    type={type ?? "text"}
                    value={form[key]}
                  />
                </div>
              ))}
              {error && (
                <p
                  className="rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive sm:col-span-2 lg:col-span-3"
                  role="alert"
                >
                  {error}
                </p>
              )}
              <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
                <Button disabled={isSaving} type="submit">
                  <Plus aria-hidden="true" data-icon="inline-start" />
                  {isSaving
                    ? "Guardando…"
                    : editingCustomer
                      ? "Guardar cambios"
                      : "Crear cliente"}
                </Button>
                <Button
                  disabled={isSaving}
                  onClick={closeForm}
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      {!isFormOpen && error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Clientes registrados</CardTitle>
              <CardDescription className="mt-1">
                Mostrando {firstResult}–{lastResult} de {customerList.total}
              </CardDescription>
            </div>
            <form
              className="flex min-w-60 flex-1 gap-2 sm:max-w-sm"
              onSubmit={(event) => {
                event.preventDefault();
                setError("");
                setIsLoading(true);
                setPage(1);
                setAppliedSearch(search.trim());
              }}
            >
              <div className="relative min-w-0 flex-1">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  aria-label="Buscar clientes"
                  className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre, apellido o email"
                  value={search}
                />
              </div>
              <Button aria-label="Buscar" size="icon" type="submit">
                <Search aria-hidden="true" />
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {isLoading ? (
            <p
              role="status"
              className="py-8 text-center text-sm text-muted-foreground"
            >
              Cargando clientes…
            </p>
          ) : customerList.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {appliedSearch
                ? "No hay clientes que coincidan con la búsqueda."
                : "No hay clientes registrados."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    {renderSortHeader("Nombre", "firstName")}
                    {renderSortHeader("Email", "email")}
                    <th className="px-3 py-2 font-medium">Teléfono</th>
                    {renderSortHeader("Ciudad", "city")}
                    <th className="px-3 py-2 text-right font-medium">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customerList.items.map((customer) => (
                      <tr key={customer.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-3 font-medium">
                          {customer.firstName} {customer.lastName}
                        </td>
                        <td className="px-3 py-3">{customer.email}</td>
                        <td className="px-3 py-3">{customer.phone}</td>
                        <td className="px-3 py-3">{customer.city}</td>
                        <td className="px-3 py-3">
                          {pendingDeleteId === customer.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-muted-foreground">
                                ¿Eliminar cliente?
                              </span>
                              <Button
                                disabled={busyId === customer.id}
                                onClick={() => void confirmDelete(customer)}
                                size="sm"
                                type="button"
                                variant="destructive"
                              >
                                {busyId === customer.id
                                  ? "Eliminando…"
                                  : "Confirmar"}
                              </Button>
                              <Button
                                disabled={busyId === customer.id}
                                onClick={() => setPendingDeleteId(null)}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <Button
                                aria-label={`Consultar ${customer.firstName} ${customer.lastName}`}
                                onClick={(event) => {
                                  detailsTriggerRef.current = event.currentTarget;
                                  void toggleDetails(customer);
                                }}
                                size="icon-sm"
                                type="button"
                                variant="outline"
                              >
                                <Eye aria-hidden="true" className="text-blue-600" />
                              </Button>
                              <Button
                                aria-label={`Editar ${customer.firstName} ${customer.lastName}`}
                                onClick={() => startEditing(customer)}
                                size="icon-sm"
                                type="button"
                                variant="outline"
                              >
                                <Pencil aria-hidden="true" />
                              </Button>
                              <Button
                                aria-label={`Eliminar ${customer.firstName} ${customer.lastName}`}
                                onClick={() => setPendingDeleteId(customer.id)}
                                size="icon-sm"
                                type="button"
                                variant="outline"
                              >
                                <Trash2 aria-hidden="true" className="text-destructive" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              Página{" "}
              {customerList.totalPages === 0 ? 0 : customerList.page} de{" "}
              {customerList.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                aria-label="Página anterior"
                disabled={isLoading || page <= 1}
                onClick={() => {
                  setError("");
                  setIsLoading(true);
                  setPage((current) => Math.max(1, current - 1));
                }}
                size="icon"
                type="button"
                variant="outline"
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                aria-label="Página siguiente"
                disabled={isLoading || page >= customerList.totalPages}
                onClick={() => {
                  setError("");
                  setIsLoading(true);
                  setPage((current) => current + 1);
                }}
                size="icon"
                type="button"
                variant="outline"
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {expandedCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setExpandedCustomer(null);
            }
          }}
        >
          <div className="my-3 w-full max-w-2xl" ref={detailsDialogRef}>
            <Card
              aria-labelledby="customer-details-title"
              aria-modal="true"
              role="dialog"
            >
              <CardHeader className="border-b">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle id="customer-details-title">
                      {expandedCustomer.firstName} {expandedCustomer.lastName}
                    </CardTitle>
                    <CardDescription>Información del cliente</CardDescription>
                  </div>
                  <Button
                    aria-label="Cerrar detalles del cliente"
                    onClick={() => setExpandedCustomer(null)}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 py-5 sm:grid-cols-2">
                {[
                  ["Email", expandedCustomer.email],
                  ["Teléfono", expandedCustomer.phone],
                  ["Dirección de envío", expandedCustomer.shippingAddress],
                  ["Ciudad", expandedCustomer.city],
                  ["Código postal", expandedCustomer.postalCode],
                  ["Registrado", formatDate(expandedCustomer.createdAt)],
                  ["Última actualización", formatDate(expandedCustomer.updatedAt)],
                ].map(([label, value]) => (
                  <div className="min-w-0 rounded-md border p-3" key={label}>
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <p className="mt-1 break-words text-sm">{value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}
