"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm, ProductImage } from "./product-form";
import {
  ApiError,
  deleteProduct,
  getBrands,
  getCategories,
  getProductImageUrl,
  getProducts,
  updateProduct,
  type Brand,
  type Category,
  type Product,
  type ProductList,
} from "@/lib/api";

type ProductSortColumn = "category" | "brand" | "stock" | "status";
type SortDirection = "asc" | "desc";

type ProductDeleteError = {
  productId: string;
  message: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Tu sesión no es válida. Inicia sesión nuevamente.";
    }
    if ([400, 404, 409, 413].includes(error.status)) {
      return error.message;
    }
  }
  return "No se pudo completar la operación. Comprueba la conexión e inténtalo nuevamente.";
}

const EMPTY_LIST: ProductList = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 0,
};

export function Products() {
  const [productList, setProductList] = useState<ProductList>(EMPTY_LIST);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [productDeleteError, setProductDeleteError] = useState<ProductDeleteError | null>(null);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterBrandId, setFilterBrandId] = useState("");
  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<ProductSortColumn>("category");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const mainCategories = useMemo(
    () => categories.filter((category) => category.parentId === null),
    [categories],
  );
  useEffect(() => {
    let active = true;
    void Promise.all([getCategories(), getBrands()])
      .then(([loadedCategories, loadedBrands]) => {
        if (active) {
          setCategories(loadedCategories);
          setBrands(loadedBrands);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(getErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (active) setReferencesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void getProducts({
      search: appliedSearch,
      categoryId: filterCategoryId,
      brandId: filterBrandId,
      isActive: filterActive,
      page,
      pageSize: 10,
      sortBy: sortColumn,
      sortDirection,
    })
      .then((result) => {
        if (active) {
          setProductList(result);
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
  }, [
    appliedSearch,
    filterActive,
    filterBrandId,
    filterCategoryId,
    page,
    refreshKey,
    sortColumn,
    sortDirection,
  ]);

  function closeForm() {
    setEditingProduct(null);
    setIsFormOpen(false);
  }

  function startEditing(product: Product) {
    setProductDeleteError(null);
    setIsFormOpen(true);
    setEditingProduct(product);
    setNotice("");
  }

  function openNewProductForm() {
    setEditingProduct(null);
    setNotice("");
    setIsFormOpen(true);
  }

  function toggleSort(column: ProductSortColumn) {
    setIsLoading(true);
    setError("");
    setPage(1);
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    setSortDirection("asc");
  }

  function renderSortHeader(label: string, column: ProductSortColumn) {
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
        className="px-2 py-2 font-medium sm:px-3"
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

  function handleFormSaved(message: string) {
    closeForm();
    setIsLoading(true);
    setError("");
    setNotice(message);
    setPage(1);
    setRefreshKey((current) => current + 1);
  }

  async function toggleActive(product: Product) {
    setProductDeleteError(null);
    setError("");
    setNotice("");
    setBusyProductId(product.id);
    try {
      await updateProduct(product.id, { isActive: !product.isActive });
      setIsLoading(true);
      setError("");
      setNotice(
        product.isActive ? "Producto desactivado." : "Producto activado.",
      );
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyProductId(null);
    }
  }

  async function confirmDelete(product: Product) {
    setProductDeleteError(null);
    setError("");
    setNotice("");
    setBusyProductId(product.id);
    try {
      await deleteProduct(product.id);
      setPendingDeleteId(null);
      setIsLoading(true);
      setError("");
      setNotice("Producto eliminado.");
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      if (
        requestError instanceof ApiError &&
        requestError.status === 409 &&
        /orden.*en preparación/i.test(requestError.message)
      ) {
        setProductDeleteError({
          productId: product.id,
          message:
            "No se puede eliminar este producto porque está asociado a una orden en preparación. Usa la opción «Desactivar».",
        });
      } else {
        setError(getErrorMessage(requestError));
      }
    } finally {
      setBusyProductId(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setAppliedSearch("");
    setFilterCategoryId("");
    setFilterBrandId("");
    setFilterActive("");
    setPage(1);
  }

  const firstResult =
    productList.total === 0 ? 0 : (productList.page - 1) * productList.pageSize + 1;
  const lastResult = Math.min(
    productList.page * productList.pageSize,
    productList.total,
  );

  return (
    <section aria-labelledby="products-title" className="min-w-0 max-w-full space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1
            id="products-title"
            className="text-xl font-semibold tracking-tight"
          >
            Productos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administra imágenes, marcas, categorías, stock y disponibilidad.
          </p>
        </div>
        <Button onClick={openNewProductForm} type="button">
          <Plus aria-hidden="true" data-icon="inline-start" />
          Nuevo producto
        </Button>
      </div>

      {isFormOpen && (
        <ProductForm
          brands={brands}
          categories={categories}
          referencesLoading={referencesLoading}
          editingProduct={editingProduct}
          onClose={closeForm}
          onSaved={handleFormSaved}
        />
      )}
      {notice && !isFormOpen && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      <Card className="min-w-0 max-w-full rounded-lg">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Productos</CardTitle>
              <CardDescription className="mt-1">
                Mostrando {firstResult}–{lastResult} de {productList.total}
              </CardDescription>
            </div>
            <form
              className="flex min-w-60 flex-1 gap-2 sm:max-w-sm"
              onSubmit={(event) => {
                event.preventDefault();
                      setIsLoading(true);
                      setError("");
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
                  aria-label="Buscar productos"
                  className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar productos"
                  value={search}
                />
              </div>
              <Button aria-label="Buscar" size="icon" type="submit">
                <Search aria-hidden="true" />
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 max-w-full space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-44 flex-1 space-y-1.5">
              <label className="text-xs font-medium" htmlFor="filter-category">
                Categoría
              </label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                id="filter-category"
                onChange={(event) => {
                  setIsLoading(true);
                  setError("");
                  setFilterCategoryId(event.target.value);
                  setPage(1);
                }}
                value={filterCategoryId}
              >
                <option value="">Todas</option>
                {mainCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-44 flex-1 space-y-1.5">
              <label className="text-xs font-medium" htmlFor="filter-brand">
                Marca
              </label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                id="filter-brand"
                onChange={(event) => {
                  setIsLoading(true);
                  setError("");
                  setFilterBrandId(event.target.value);
                  setPage(1);
                }}
                value={filterBrandId}
              >
                <option value="">Todas</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-36 flex-1 space-y-1.5">
              <label className="text-xs font-medium" htmlFor="filter-status">
                Estado
              </label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                id="filter-status"
                onChange={(event) => {
                  setIsLoading(true);
                  setError("");
                  setFilterActive(event.target.value as "" | "true" | "false");
                  setPage(1);
                }}
                value={filterActive}
              >
                <option value="">Todos</option>
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>
            <Button
              onClick={() => {
                if (
                  appliedSearch ||
                  filterCategoryId ||
                  filterBrandId ||
                  filterActive ||
                  page !== 1
                ) {
                  setIsLoading(true);
                }
                setError("");
                clearFilters();
              }}
              type="button"
              variant="outline"
            >
              Limpiar filtros
            </Button>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {isLoading ? (
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">
              Cargando productos…
            </p>
          ) : productList.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {productList.total === 0
                ? "No hay productos que coincidan con los filtros."
                : "No hay productos en esta página."}
            </p>
          ) : (
            <div
              aria-label="Tabla de productos"
              className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain"
              tabIndex={0}
            >
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-2 py-2 font-medium sm:px-3">Producto</th>
                    {renderSortHeader("Categoría", "category")}
                    {renderSortHeader("Marca", "brand")}
                    {renderSortHeader("Stock total", "stock")}
                    {renderSortHeader("Estado", "status")}
                    <th className="px-2 py-2 text-right font-medium sm:px-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productList.items.map((product) => (
                    <Fragment key={product.id}>
                      <tr className="border-b border-border last:border-0">
                        <td className="px-2 py-3 sm:px-3">
                          <div className="flex items-center gap-3">
                            <ProductImage
                              alt=""
                              className="size-12 shrink-0 rounded-md border border-border object-cover"
                              src={getProductImageUrl(product.imageUrl)}
                            />
                            <div className="min-w-0">
                              <p className="font-medium">{product.name}</p>
                              <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                                {product.description || "Sin descripción"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-3 sm:px-3">
                          <div>{product.category.name}</div>
                          {product.subcategory && (
                            <div className="text-xs text-muted-foreground">
                              {product.subcategory.name}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-3 sm:px-3">{product.brand.name}</td>
                        <td className="px-2 py-3 sm:px-3">
                          <Badge
                            variant="outline"
                            className={
                              product.stock > 20
                                ? "h-auto border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800"
                                : product.stock >= 10
                                  ? "h-auto border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800"
                                  : "h-auto border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-800"
                            }
                          >
                            {product.stock} {product.stock === 1 ? "unidad" : "unidades"}
                          </Badge>
                        </td>
                        <td className="px-2 py-3 sm:px-3">
                          <Badge
                            variant="outline"
                            className={
                              product.isActive
                                ? "h-auto border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800"
                                : "h-auto border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-800"
                            }
                          >
                            {product.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </td>
                        <td className="px-2 py-3 sm:px-3">
                          {pendingDeleteId === product.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-muted-foreground">
                                ¿Eliminar producto?
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
                                onClick={() => {
                                  setPendingDeleteId(null);
                                  setProductDeleteError(null);
                                }}
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
                              <Button
                                aria-label={`Eliminar ${product.name}`}
                                disabled={busyProductId === product.id}
                                onClick={() => {
                                  setProductDeleteError(null);
                                  setPendingDeleteId(product.id);
                                }}
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
                      {productDeleteError?.productId === product.id && (
                        <tr>
                          <td className="px-2 pb-3 sm:px-3" colSpan={6}>
                            <p
                              role="alert"
                              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                            >
                              {productDeleteError.message}
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              Página {productList.totalPages === 0 ? 0 : productList.page} de{" "}
              {productList.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                aria-label="Página anterior"
                disabled={isLoading || page <= 1}
                onClick={() => {
                  setIsLoading(true);
                  setError("");
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
                disabled={isLoading || page >= productList.totalPages}
                onClick={() => {
                  setIsLoading(true);
                  setError("");
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
    </section>
  );
}
