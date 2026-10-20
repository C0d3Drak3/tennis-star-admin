"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Check, Plus, X } from "lucide-react";
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
  getBrands,
  getCategories,
  getProductImageUrl,
  updateProduct,
  type Brand,
  type Category,
  type Product,
  type ProductInput,
} from "@/lib/api";

const MAX_PRODUCT_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2_000;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const PRICE_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function isPositivePrice(value: string): boolean {
  if (!PRICE_PATTERN.test(value)) return false;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) > 0 || /[1-9]/.test(fraction);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Tu sesión no es válida. Inicia sesión nuevamente.";
    if ([400, 404, 409, 413].includes(error.status)) return error.message;
  }
  return "No se pudo completar la operación. Comprueba la conexión e inténtalo nuevamente.";
}

export function ProductImage({
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

interface ProductFormProps {
  categories?: Category[];
  brands?: Brand[];
  referencesLoading?: boolean;
  editingProduct?: Product | null;
  onClose: () => void;
  onSaved: (notice: string) => void;
  onSavingChange?: (saving: boolean) => void;
}

export function ProductForm({
  categories: suppliedCategories,
  brands: suppliedBrands,
  referencesLoading: suppliedReferencesLoading,
  editingProduct = null,
  onClose,
  onSaved,
  onSavingChange,
}: ProductFormProps) {
  const [loadedCategories, setLoadedCategories] = useState<Category[]>([]);
  const [loadedBrands, setLoadedBrands] = useState<Brand[]>([]);
  const [localReferencesLoading, setLocalReferencesLoading] = useState(
    suppliedCategories === undefined || suppliedBrands === undefined,
  );
  const [referenceError, setReferenceError] = useState("");
  const categories = suppliedCategories ?? loadedCategories;
  const brands = suppliedBrands ?? loadedBrands;
  const referencesLoading = suppliedReferencesLoading ?? localReferencesLoading;
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(editingProduct?.name ?? "");
  const [price, setPrice] = useState(editingProduct?.price ?? "");
  const [description, setDescription] = useState(editingProduct?.description ?? "");
  const [brandId, setBrandId] = useState(editingProduct?.brandId ?? "");
  const [categoryId, setCategoryId] = useState(editingProduct?.categoryId ?? "");
  const [subcategoryId, setSubcategoryId] = useState(editingProduct?.subcategoryId ?? "");
  const [stock, setStock] = useState(editingProduct ? String(editingProduct.stock) : "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageButtonHovered, setImageButtonHovered] = useState(false);
  const [imageInputFocused, setImageInputFocused] = useState(false);
  const [imagePreview, setImagePreview] = useState(
    editingProduct ? getProductImageUrl(editingProduct.imageUrl) : "",
  );
  const [formError, setFormError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mainCategories = useMemo(
    () => categories.filter((category) => category.parentId === null),
    [categories],
  );
  const subcategories = useMemo(
    () => categories.filter((category) => category.parentId === categoryId),
    [categories, categoryId],
  );

  useEffect(() => {
    if (suppliedCategories !== undefined && suppliedBrands !== undefined) return;
    let active = true;
    void Promise.all([getCategories(), getBrands()])
      .then(([loadedCategoryList, loadedBrandList]) => {
        if (!active) return;
        setLoadedCategories(loadedCategoryList);
        setLoadedBrands(loadedBrandList);
      })
      .catch((error: unknown) => {
        if (active) setReferenceError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setLocalReferencesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [suppliedBrands, suppliedCategories]);

  useEffect(
    () => () => {
      if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    },
    [imagePreview],
  );

  function handleImageChange(file: File | undefined) {
    setFormError("");
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
      setFormError("Usa una imagen JPEG, PNG, GIF o WebP.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageFile(null);
      setImagePreview(
        editingProduct ? getProductImageUrl(editingProduct.imageUrl) : "",
      );
      setFormError("La imagen no puede superar los 5 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const normalizedName = name.trim();
    const normalizedPrice = price.trim();
    const parsedStock = /^\d+$/.test(stock.trim()) ? Number(stock) : Number.NaN;

    if (!normalizedName || normalizedName.length > MAX_PRODUCT_NAME_LENGTH) {
      setFormError(`El nombre debe tener entre 1 y ${MAX_PRODUCT_NAME_LENGTH} caracteres.`);
      return;
    }
    if (!isPositivePrice(normalizedPrice)) {
      setFormError("El precio debe ser positivo y tener hasta dos decimales.");
      return;
    }
    if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
      setFormError(`La descripción debe tener hasta ${MAX_DESCRIPTION_LENGTH} caracteres.`);
      return;
    }
    if (!brands.some((brand) => brand.id === brandId)) {
      setFormError("Selecciona una marca existente.");
      return;
    }
    if (!mainCategories.some((category) => category.id === categoryId)) {
      setFormError("Selecciona una categoría principal existente.");
      return;
    }
    if (
      subcategoryId &&
      !subcategories.some((subcategory) => subcategory.id === subcategoryId)
    ) {
      setFormError("Selecciona una subcategoría de la categoría principal elegida.");
      return;
    }
    if (!Number.isSafeInteger(parsedStock) || parsedStock < 0) {
      setFormError("El stock debe ser un número entero no negativo.");
      return;
    }
    if (!editingProduct && !imageFile) {
      setFormError("Debes cargar una imagen para el producto.");
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
    onSavingChange?.(true);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, input, imageFile ?? undefined);
      } else if (imageFile) {
        await createProduct(input, imageFile);
      }
      onSaved(editingProduct ? "Producto actualizado." : "Producto creado.");
    } catch (error: unknown) {
      setFormError(getErrorMessage(error));
    } finally {
      setIsSaving(false);
      onSavingChange?.(false);
    }
  }

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>{editingProduct ? "Editar producto" : "Nuevo producto"}</CardTitle>
            <CardDescription>
              Los productos vinculados a ventas se conservan en el historial y se
              pueden desactivar.
            </CardDescription>
          </div>
          <Button
            aria-label="Cerrar formulario"
            disabled={isSaving}
            onClick={onClose}
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
              <label htmlFor="product-name" className="text-sm font-medium">Nombre</label>
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
              <label htmlFor="product-price" className="text-sm font-medium">Precio (ARS)</label>
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
              <label htmlFor="product-brand" className="text-sm font-medium">Marca</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={isSaving || referencesLoading || brands.length === 0}
                id="product-brand"
                onChange={(event) => setBrandId(event.target.value)}
                required
                value={brandId}
              >
                <option value="">Selecciona una marca</option>
                {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="product-category" className="text-sm font-medium">Categoría principal</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={isSaving || referencesLoading || mainCategories.length === 0}
                id="product-category"
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setSubcategoryId("");
                }}
                required
                value={categoryId}
              >
                <option value="">Selecciona una categoría</option>
                {mainCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="product-subcategory" className="text-sm font-medium">
                Subcategoría <span className="text-muted-foreground">(opcional)</span>
              </label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={isSaving || referencesLoading || !categoryId || subcategories.length === 0}
                id="product-subcategory"
                onChange={(event) => setSubcategoryId(event.target.value)}
                value={subcategoryId}
              >
                <option value="">Sin subcategoría</option>
                {subcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="product-stock" className="text-sm font-medium">Stock</label>
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
              <label htmlFor="product-description" className="text-sm font-medium">
                Descripción <span className="text-muted-foreground">(opcional)</span>
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
              <label htmlFor="product-image" className="text-sm font-medium">Imagen</label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  accept={ACCEPTED_IMAGE_TYPES.join(",")}
                  aria-label="Seleccionar archivo de imagen"
                  disabled={isSaving}
                  id="product-image"
                  onChange={(event) => handleImageChange(event.currentTarget.files?.[0])}
                  onBlur={() => setImageInputFocused(false)}
                  onFocus={() => setImageInputFocused(true)}
                  ref={fileInputRef}
                  required={!editingProduct}
                  style={{
                    position: "absolute",
                    width: "1px",
                    height: "1px",
                    padding: 0,
                    margin: "-1px",
                    overflow: "hidden",
                    clip: "rect(0, 0, 0, 0)",
                    whiteSpace: "nowrap",
                    border: 0,
                  }}
                  type="file"
                />
                <label
                  className="product-image-button"
                  htmlFor="product-image"
                  onMouseEnter={() => setImageButtonHovered(true)}
                  onMouseLeave={() => setImageButtonHovered(false)}
                  style={{
                    backgroundColor: imageButtonHovered ? "#D4D4D4" : "#E5E5E5",
                    border: `1px solid ${imageButtonHovered ? "#8A8A8A" : "#B8B8B8"}`,
                    borderRadius: "var(--radius-md)",
                    color: "#171717",
                    outline: imageInputFocused ? "2px solid var(--ring)" : "none",
                    outlineOffset: imageInputFocused ? "2px" : "0",
                    transition: "background-color 150ms ease, border-color 150ms ease",
                  }}
                >
                  Seleccionar archivo
                </label>
                <span className="min-w-0 break-all text-sm text-muted-foreground">
                  {imageFile?.name ?? "Ningún archivo seleccionado"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">JPEG, PNG, GIF o WebP; máximo 5 MB.</p>
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
          {referencesLoading && (
            <p role="status" className="text-sm text-muted-foreground">
              Cargando marcas y categorías…
            </p>
          )}
          {referenceError && <p role="alert" className="text-sm text-destructive">{referenceError}</p>}
          {!referencesLoading && (brands.length === 0 || mainCategories.length === 0) && (
            <p className="text-sm text-muted-foreground">
              Crea al menos una marca y una categoría principal antes de registrar productos.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              disabled={isSaving || referencesLoading || brands.length === 0 || mainCategories.length === 0}
              type="submit"
            >
              {editingProduct ? (
                <Check aria-hidden="true" data-icon="inline-start" />
              ) : (
                <Plus aria-hidden="true" data-icon="inline-start" />
              )}
              {isSaving ? "Guardando…" : editingProduct ? "Guardar cambios" : "Crear producto"}
            </Button>
            <Button disabled={isSaving} onClick={onClose} type="button" variant="outline">
              Cancelar
            </Button>
          </div>
        </form>
        {formError && (
          <p role="alert" className="mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
