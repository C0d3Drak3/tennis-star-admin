"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
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
  createProduct,
  deleteProduct,
  getCategories,
  getProducts,
  updateProduct,
  type Category,
  type Product,
  type ProductInput,
} from "@/lib/api";

const MAX_PRODUCT_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2_000;
const PRICE_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

function isPositivePrice(value: string): boolean {
  if (!PRICE_PATTERN.test(value)) {
    return false;
  }
  const [whole, fraction = ""] = value.split(".");
  return (
    Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0")) > 0
  );
}

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

function formatPrice(price: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(Number(price));
}

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([getProducts(), getCategories()])
      .then(([loadedProducts, loadedCategories]) => {
        if (!active) {
          return;
        }
        setProducts(loadedProducts);
        setCategories(loadedCategories);
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
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setPrice("");
    setDescription("");
    setCategoryId("");
  }

  function startEditing(product: Product) {
    setEditingId(product.id);
    setName(product.name);
    setPrice(product.price);
    setDescription(product.description ?? "");
    setCategoryId(product.categoryId);
    setError("");
    setNotice("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const normalizedName = name.trim();
    const normalizedPrice = price.trim();
    const input: ProductInput = {
      name: normalizedName,
      price: normalizedPrice,
      description: description.trim() || null,
      categoryId,
    };

    if (
      normalizedName.length === 0 ||
      normalizedName.length > MAX_PRODUCT_NAME_LENGTH
    ) {
      setError(
        `El nombre debe tener entre 1 y ${MAX_PRODUCT_NAME_LENGTH} caracteres.`,
      );
      return;
    }
    if (!isPositivePrice(normalizedPrice)) {
      setError("El precio debe ser positivo y tener hasta dos decimales.");
      return;
    }
    if (input.description && input.description.length > MAX_DESCRIPTION_LENGTH) {
      setError(
        `La descripción debe tener hasta ${MAX_DESCRIPTION_LENGTH} caracteres.`,
      );
      return;
    }
    if (!categories.some((category) => category.id === categoryId)) {
      setError("Selecciona una categoría existente.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        const updated = await updateProduct(editingId, input);
        setProducts((current) =>
          current
            .map((product) =>
              product.id === updated.id
                ? { ...product, ...updated }
                : product,
            )
            .sort((a, b) => a.name.localeCompare(b.name, "es")),
        );
        setNotice("Producto actualizado.");
      } else {
        const created = await createProduct(input);
        setProducts((current) =>
          [...current, { ...created, saleItemCount: 0 }].sort((a, b) =>
            a.name.localeCompare(b.name, "es"),
          ),
        );
        setNotice("Producto creado.");
      }
      resetForm();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleActive(product: Product) {
    setError("");
    setNotice("");
    setBusyProductId(product.id);
    try {
      const updated = await updateProduct(product.id, {
        isActive: !product.isActive,
      });
      setProducts((current) =>
        current.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        ),
      );
      setNotice(
        updated.isActive ? "Producto activado." : "Producto desactivado.",
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyProductId(null);
    }
  }

  async function confirmDelete(product: Product) {
    setError("");
    setNotice("");
    setBusyProductId(product.id);
    try {
      await deleteProduct(product.id);
      setProducts((current) =>
        current.filter((item) => item.id !== product.id),
      );
      setPendingDeleteId(null);
      setNotice("Producto eliminado.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyProductId(null);
    }
  }

  return (
    <section aria-labelledby="products-title" className="space-y-5">
      <div>
        <h1
          id="products-title"
          className="text-xl font-semibold tracking-tight"
        >
          Productos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administra productos, precios, categorías y disponibilidad.
        </p>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>{editingId ? "Editar producto" : "Nuevo producto"}</CardTitle>
          <CardDescription>
            El precio admite hasta dos decimales. Los productos vendidos se
            retiran del catálogo desactivándolos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSave} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="product-name" className="text-sm font-medium">
                  Nombre
                </label>
                <input
                  autoComplete="off"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  disabled={isSaving}
                  id="product-name"
                  maxLength={MAX_PRODUCT_NAME_LENGTH}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="product-price" className="text-sm font-medium">
                  Precio (ARS)
                </label>
                <input
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  disabled={isSaving}
                  id="product-price"
                  inputMode="decimal"
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="0.00"
                  required
                  value={price}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="product-category"
                  className="text-sm font-medium"
                >
                  Categoría
                </label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  disabled={isSaving || categories.length === 0}
                  id="product-category"
                  onChange={(event) => setCategoryId(event.target.value)}
                  required
                  value={categoryId}
                >
                  <option value="">Selecciona una categoría</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="product-description"
                  className="text-sm font-medium"
                >
                  Descripción <span className="text-muted-foreground">(opcional)</span>
                </label>
                <input
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  disabled={isSaving}
                  id="product-description"
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  onChange={(event) => setDescription(event.target.value)}
                  value={description}
                />
              </div>
            </div>
            {categories.length === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground">
                Crea una categoría antes de registrar productos.
              </p>
            )}
            <div className="flex gap-2">
              <Button
                disabled={isSaving || categories.length === 0}
                type="submit"
              >
                {editingId ? (
                  <Check aria-hidden="true" data-icon="inline-start" />
                ) : (
                  <Plus aria-hidden="true" data-icon="inline-start" />
                )}
                {isSaving
                  ? "Guardando…"
                  : editingId
                    ? "Guardar cambios"
                    : "Crear producto"}
              </Button>
              {editingId && (
                <Button
                  disabled={isSaving}
                  onClick={resetForm}
                  type="button"
                  variant="outline"
                >
                  <X aria-hidden="true" data-icon="inline-start" />
                  Cancelar
                </Button>
              )}
            </div>
          </form>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mt-4 text-sm text-muted-foreground">
              {notice}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Productos existentes</CardTitle>
          <CardDescription>
            {products.length} {products.length === 1 ? "producto" : "productos"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p
              role="status"
              className="py-8 text-center text-sm text-muted-foreground"
            >
              Cargando productos…
            </p>
          ) : error && products.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {error}
            </p>
          ) : products.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Todavía no hay productos. Crea el primero desde el formulario.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Producto</th>
                    <th className="px-3 py-2 font-medium">Precio</th>
                    <th className="px-3 py-2 font-medium">Categoría</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-3">
                        <p className="font-medium">{product.name}</p>
                        {product.description && (
                          <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                            {product.description}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">{formatPrice(product.price)}</td>
                      <td className="px-3 py-3">{product.category.name}</td>
                      <td className="px-3 py-3">
                        <span
                          className={
                            product.isActive
                              ? "text-xs font-medium text-foreground"
                              : "text-xs text-muted-foreground"
                          }
                        >
                          {product.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {pendingDeleteId === product.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-muted-foreground">
                              ¿Eliminar físicamente?
                            </span>
                            <Button
                              disabled={busyProductId === product.id}
                              onClick={() => void confirmDelete(product)}
                              size="sm"
                              type="button"
                              variant="destructive"
                            >
                              {busyProductId === product.id
                                ? "Eliminando…"
                                : "Confirmar"}
                            </Button>
                            <Button
                              disabled={busyProductId === product.id}
                              onClick={() => setPendingDeleteId(null)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              aria-label={`Editar ${product.name}`}
                              disabled={busyProductId === product.id}
                              onClick={() => startEditing(product)}
                              size="icon-sm"
                              type="button"
                              variant="outline"
                            >
                              <Pencil aria-hidden="true" />
                            </Button>
                            <Button
                              disabled={busyProductId === product.id}
                              onClick={() => void toggleActive(product)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {busyProductId === product.id
                                ? "Actualizando…"
                                : product.isActive
                                  ? "Desactivar"
                                  : "Activar"}
                            </Button>
                            {product.saleItemCount ? (
                              <span className="text-xs text-muted-foreground">
                                Asociado a ventas; desactívalo para retirarlo
                              </span>
                            ) : (
                              <Button
                                aria-label={`Eliminar ${product.name}`}
                                disabled={busyProductId === product.id}
                                onClick={() =>
                                  setPendingDeleteId(product.id)
                                }
                                size="icon-sm"
                                type="button"
                                variant="outline"
                              >
                                <Trash2 aria-hidden="true" />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
