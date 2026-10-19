"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
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
  createProduct,
  deleteProduct,
  getBrands,
  getCategories,
  getProductImageUrl,
  getProducts,
  updateProduct,
  type Brand,
  type Category,
  type Product,
  type ProductInput,
  type ProductList,
} from "@/lib/api";

const MAX_PRODUCT_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2_000;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const PRICE_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
type ProductSortColumn = "category" | "brand" | "stock" | "price" | "status";
type SortDirection = "asc" | "desc";

function isPositivePrice(value: string): boolean {
  if (!PRICE_PATTERN.test(value)) {
    return false;
  }
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) > 0 || /[1-9]/.test(fraction);
}

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

function formatPrice(price: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(Number(price));
}

function ProductImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  // The source is the configurable API origin, so it cannot use Next's static image allowlist.
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} className={className} src={src} />;
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterBrandId, setFilterBrandId] = useState("");
  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<ProductSortColumn>("category");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [refreshKey, setRefreshKey] = useState(0);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [stock, setStock] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mainCategories = useMemo(
    () => categories.filter((category) => category.parentId === null),
    [categories],
  );
  const subcategories = useMemo(
    () =>
      categories.filter(
        (category) => category.parentId === categoryId,
      ),
    [categories, categoryId],
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

  useEffect(
    () => () => {
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    },
    [imagePreview],
  );

  function resetForm() {
    setEditingProduct(null);
    setIsFormOpen(false);
    setName("");
    setPrice("");
    setDescription("");
    setBrandId("");
    setCategoryId("");
    setSubcategoryId("");
    setStock("");
    setImageFile(null);
    setImagePreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function closeForm() {
    resetForm();
    setError("");
  }

  function startEditing(product: Product) {
    setIsFormOpen(true);
    setEditingProduct(product);
    setName(product.name);
    setPrice(product.price);
    setDescription(product.description ?? "");
    setBrandId(product.brandId);
    setCategoryId(product.categoryId);
    setSubcategoryId(product.subcategoryId ?? "");
    setStock(String(product.stock));
    setImageFile(null);
    setImagePreview(getProductImageUrl(product.imageUrl));
    setError("");
    setNotice("");
  }

  function openNewProductForm() {
    resetForm();
    setError("");
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

  function handleImageChange(file: File | undefined) {
    setError("");
    if (!file) {
      setImageFile(null);
      setImagePreview(
        editingProduct ? getProductImageUrl(editingProduct.imageUrl) : "",
      );
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageFile(null);
      setImagePreview(
        editingProduct ? getProductImageUrl(editingProduct.imageUrl) : "",
      );
      setError("Usa una imagen JPEG, PNG, GIF o WebP.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageFile(null);
      setImagePreview(
        editingProduct ? getProductImageUrl(editingProduct.imageUrl) : "",
      );
      setError("La imagen no puede superar los 5 MB.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const normalizedName = name.trim();
    const normalizedPrice = price.trim();
    const parsedStock = /^\d+$/.test(stock.trim()) ? Number(stock) : Number.NaN;

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
    if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
      setError(
        `La descripción debe tener hasta ${MAX_DESCRIPTION_LENGTH} caracteres.`,
      );
      return;
    }
    if (!brands.some((brand) => brand.id === brandId)) {
      setError("Selecciona una marca existente.");
      return;
    }
    if (!mainCategories.some((category) => category.id === categoryId)) {
      setError("Selecciona una categoría principal existente.");
      return;
    }
    if (
      subcategoryId &&
      !subcategories.some((subcategory) => subcategory.id === subcategoryId)
    ) {
      setError("Selecciona una subcategoría de la categoría principal elegida.");
      return;
    }
    if (!Number.isSafeInteger(parsedStock) || parsedStock < 0) {
      setError("El stock debe ser un número entero no negativo.");
      return;
    }
    if (!editingProduct && !imageFile) {
      setError("Debes cargar una imagen para el producto.");
      return;
    }

    const input: ProductInput = {
      name: normalizedName,
      price: normalizedPrice,
      description: description.trim() || null,
      brandId,
      categoryId,
      subcategoryId: subcategoryId || null,
      stock: parsedStock,
    };

    setIsSaving(true);
    try {
      if (editingProduct) {
        await updateProduct(
          editingProduct.id,
          input,
          imageFile ?? undefined,
        );
        setNotice("Producto actualizado.");
      } else if (imageFile) {
        await createProduct(input, imageFile);
        setNotice("Producto creado.");
      }
      resetForm();
      setIsLoading(true);
      setError("");
      setPage(1);
      setRefreshKey((current) => current + 1);
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
      setError(getErrorMessage(requestError));
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
    <section aria-labelledby="products-title" className="space-y-5">
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
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle>
                {editingProduct ? "Editar producto" : "Nuevo producto"}
              </CardTitle>
              <CardDescription>
                Los productos vinculados a ventas se conservan en el historial y se
                pueden desactivar.
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
          <form className="space-y-4" onSubmit={handleSave} noValidate>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <label htmlFor="product-name" className="text-sm font-medium">
                  Nombre
                </label>
                <input
                  autoComplete="off"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
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
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
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
                <label htmlFor="product-brand" className="text-sm font-medium">
                  Marca
                </label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={isSaving || brands.length === 0}
                  id="product-brand"
                  onChange={(event) => setBrandId(event.target.value)}
                  required
                  value={brandId}
                >
                  <option value="">Selecciona una marca</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="product-category"
                  className="text-sm font-medium"
                >
                  Categoría principal
                </label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={isSaving || mainCategories.length === 0}
                  id="product-category"
                  onChange={(event) => {
                    setCategoryId(event.target.value);
                    setSubcategoryId("");
                  }}
                  required
                  value={categoryId}
                >
                  <option value="">Selecciona una categoría</option>
                  {mainCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="product-subcategory"
                  className="text-sm font-medium"
                >
                  Subcategoría{" "}
                  <span className="text-muted-foreground">(opcional)</span>
                </label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={isSaving || !categoryId || subcategories.length === 0}
                  id="product-subcategory"
                  onChange={(event) => setSubcategoryId(event.target.value)}
                  value={subcategoryId}
                >
                  <option value="">Sin subcategoría</option>
                  {subcategories.map((subcategory) => (
                    <option key={subcategory.id} value={subcategory.id}>
                      {subcategory.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="product-stock" className="text-sm font-medium">
                  Stock
                </label>
                <input
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  disabled={isSaving}
                  id="product-stock"
                  min={0}
                  onChange={(event) => setStock(event.target.value)}
                  required
                  step={1}
                  type="number"
                  value={stock}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <label
                  htmlFor="product-description"
                  className="text-sm font-medium"
                >
                  Descripción{" "}
                  <span className="text-muted-foreground">(opcional)</span>
                </label>
                <textarea
                  className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  disabled={isSaving}
                  id="product-description"
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  onChange={(event) => setDescription(event.target.value)}
                  value={description}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="product-image" className="text-sm font-medium">
                  Imagen
                </label>
                <input
                  accept={ACCEPTED_IMAGE_TYPES.join(",")}
                  className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm"
                  disabled={isSaving}
                  id="product-image"
                  onChange={(event) =>
                    handleImageChange(event.currentTarget.files?.[0])
                  }
                  ref={fileInputRef}
                  required={!editingProduct}
                  type="file"
                />
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG, GIF o WebP; máximo 5 MB.
                </p>
              </div>
              {imagePreview && (
                <div className="flex items-end sm:col-span-2">
                  <ProductImage
                    alt={`Vista previa de ${name || "producto"}`}
                    className="size-24 rounded-md border border-border object-cover"
                    src={imagePreview}
                  />
                </div>
              )}
            </div>
            {(brands.length === 0 || mainCategories.length === 0) &&
              !isLoading && (
                <p className="text-sm text-muted-foreground">
                  Crea al menos una marca y una categoría principal antes de
                  registrar productos.
                </p>
              )}
            <div className="flex gap-2">
              <Button
                disabled={
                  isSaving || brands.length === 0 || mainCategories.length === 0
                }
                type="submit"
              >
                {editingProduct ? (
                  <Check aria-hidden="true" data-icon="inline-start" />
                ) : (
                  <Plus aria-hidden="true" data-icon="inline-start" />
                )}
                {isSaving
                  ? "Guardando…"
                  : editingProduct
                    ? "Guardar cambios"
                    : "Crear producto"}
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
      )}
      {notice && !isFormOpen && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      <Card className="rounded-lg">
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
        <CardContent className="space-y-4">
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Producto</th>
                    {renderSortHeader("Categoría", "category")}
                    {renderSortHeader("Marca", "brand")}
                    {renderSortHeader("Stock total", "stock")}
                    {renderSortHeader("Precio", "price")}
                    {renderSortHeader("Estado", "status")}
                    <th className="px-3 py-2 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productList.items.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-3">
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
                      <td className="px-3 py-3">
                        <div>{product.category.name}</div>
                        {product.subcategory && (
                          <div className="text-xs text-muted-foreground">
                            {product.subcategory.name}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">{product.brand.name}</td>
                      <td className="px-3 py-3">{product.stock}</td>
                      <td className="px-3 py-3">{formatPrice(product.price)}</td>
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
                                Venta relacionada; usa desactivación
                              </span>
                            ) : (
                              <Button
                                aria-label={`Eliminar ${product.name}`}
                                disabled={busyProductId === product.id}
                                onClick={() => setPendingDeleteId(product.id)}
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
