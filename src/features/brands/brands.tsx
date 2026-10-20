"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
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
  createBrand,
  deleteBrand,
  getBrands,
  updateBrand,
  type Brand,
} from "@/lib/api";

const MAX_BRAND_NAME_LENGTH = 100;

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

export function Brands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void getBrands()
      .then((items) => {
        if (active) {
          setBrands(items);
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
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
  }

  function startEditing(brand: Brand) {
    setEditingId(brand.id);
    setName(brand.name);
    setError("");
    setNotice("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const normalizedName = name.trim();
    if (
      normalizedName.length === 0 ||
      normalizedName.length > MAX_BRAND_NAME_LENGTH
    ) {
      setError(
        `El nombre debe tener entre 1 y ${MAX_BRAND_NAME_LENGTH} caracteres.`,
      );
      return;
    }

    setIsSaving(true);
    try {
      const brand = editingId
        ? await updateBrand(editingId, normalizedName)
        : await createBrand(normalizedName);
      setBrands((current) =>
        editingId
          ? current.map((item) =>
              item.id === brand.id ? { ...item, ...brand } : item,
            )
          : [...current, { ...brand, productCount: 0 }].sort((a, b) =>
              a.name.localeCompare(b.name, "es"),
            ),
      );
      setNotice(editingId ? "Marca actualizada." : "Marca creada.");
      resetForm();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete(brand: Brand) {
    setError("");
    setNotice("");
    setBusyId(brand.id);
    try {
      await deleteBrand(brand.id);
      setBrands((current) => current.filter((item) => item.id !== brand.id));
      setPendingDeleteId(null);
      setNotice("Marca eliminada.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="brands-title" className="space-y-5">
      <div>
        <h1 id="brands-title" className="text-xl font-semibold tracking-tight">
          Marcas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administra las marcas disponibles para los productos.
        </p>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>{editingId ? "Editar marca" : "Nueva marca"}</CardTitle>
          <CardDescription>
            Los nombres son únicos. Las marcas asociadas a productos no se
            pueden eliminar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={handleSave}
            noValidate
          >
            <div className="w-full space-y-1.5 sm:max-w-md">
              <label htmlFor="brand-name" className="text-sm font-medium">
                Nombre
              </label>
              <input
                autoComplete="off"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                disabled={isSaving}
                id="brand-name"
                maxLength={MAX_BRAND_NAME_LENGTH}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </div>
            <div className="flex gap-2">
              <Button disabled={isSaving} type="submit">
                <Plus aria-hidden="true" data-icon="inline-start" />
                {isSaving
                  ? "Guardando…"
                  : editingId
                    ? "Guardar cambios"
                    : "Crear marca"}
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
          <CardTitle>Marcas existentes</CardTitle>
          <CardDescription>
            {brands.length} {brands.length === 1 ? "marca" : "marcas"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">
              Cargando marcas…
            </p>
          ) : error && brands.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{error}</p>
          ) : brands.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay marcas cargadas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Nombre</th>
                    <th className="px-3 py-2 font-medium">Productos</th>
                    <th className="px-3 py-2 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {brands.map((brand) => (
                    <Fragment key={brand.id}>
                      <tr
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-3 py-3 font-medium">{brand.name}</td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {brand.productCount ?? 0}
                        </td>
                        <td className="px-3 py-3">
                          {pendingDeleteId === brand.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="mr-auto text-xs text-muted-foreground">
                                ¿Eliminar esta marca?
                              </span>
                              <Button
                                disabled={busyId === brand.id}
                                onClick={() => void confirmDelete(brand)}
                                size="sm"
                                type="button"
                                variant="destructive"
                              >
                                {busyId === brand.id ? "Eliminando…" : "Confirmar"}
                              </Button>
                              <Button
                                disabled={busyId === brand.id}
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
                                aria-label={`Editar ${brand.name}`}
                                onClick={() => startEditing(brand)}
                                size="icon-sm"
                                type="button"
                                variant="outline"
                              >
                                <Pencil aria-hidden="true" />
                              </Button>
                              <Button
                                aria-label={`Eliminar ${brand.name}`}
                                disabled={
                                  busyId === brand.id ||
                                  Boolean(brand.productCount)
                                }
                                onClick={() => setPendingDeleteId(brand.id)}
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
                    </Fragment>
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
