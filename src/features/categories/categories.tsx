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
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
  type Category,
} from "@/lib/api";

const MAX_CATEGORY_NAME_LENGTH = 100;

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Tu sesión no es válida. Inicia sesión nuevamente.";
    }
    if (error.status === 409 || error.status === 400 || error.status === 404) {
      return error.message;
    }
  }
  return "No se pudo completar la operación. Comprueba la conexión e inténtalo nuevamente.";
}

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void getCategories()
      .then((items) => {
        if (active) {
          setCategories(items);
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

  function startEditing(category: Category) {
    setEditingId(category.id);
    setName(category.name);
    setError("");
    setNotice("");
  }

  function cancelEditing() {
    setEditingId(null);
    setName("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const normalizedName = name.trim();
    if (
      normalizedName.length === 0 ||
      normalizedName.length > MAX_CATEGORY_NAME_LENGTH
    ) {
      setError(
        `El nombre debe tener entre 1 y ${MAX_CATEGORY_NAME_LENGTH} caracteres.`,
      );
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        const updated = await updateCategory(editingId, normalizedName);
        setCategories((current) =>
          current
            .map((category) =>
              category.id === updated.id
                ? { ...category, ...updated }
                : category,
            )
            .sort((a, b) => a.name.localeCompare(b.name, "es")),
        );
        setNotice("Categoría actualizada.");
      } else {
        const created = await createCategory(normalizedName);
        setCategories((current) =>
          [...current, created].sort((a, b) =>
            a.name.localeCompare(b.name, "es"),
          ),
        );
        setNotice("Categoría creada.");
      }
      setEditingId(null);
      setName("");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete(category: Category) {
    setError("");
    setNotice("");
    setDeletingId(category.id);
    try {
      await deleteCategory(category.id);
      setCategories((current) =>
        current.filter((item) => item.id !== category.id),
      );
      setPendingDeleteId(null);
      setNotice("Categoría eliminada.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section aria-labelledby="categories-title" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            id="categories-title"
            className="text-xl font-semibold tracking-tight"
          >
            Categorías
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organiza los productos del catálogo por categoría.
          </p>
        </div>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>{editingId ? "Editar categoría" : "Nueva categoría"}</CardTitle>
          <CardDescription>
            El nombre debe ser único y tener hasta {MAX_CATEGORY_NAME_LENGTH}{" "}
            caracteres.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={handleSave}
            noValidate
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <label htmlFor="category-name" className="text-sm font-medium">
                Nombre de la categoría
              </label>
              <input
                autoComplete="off"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                disabled={isSaving}
                id="category-name"
                maxLength={MAX_CATEGORY_NAME_LENGTH}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Calzado"
                required
                value={name}
              />
            </div>
            <div className="flex gap-2">
              <Button disabled={isSaving} type="submit">
                {editingId ? (
                  <Check aria-hidden="true" data-icon="inline-start" />
                ) : (
                  <Plus aria-hidden="true" data-icon="inline-start" />
                )}
                {isSaving
                  ? "Guardando…"
                  : editingId
                    ? "Guardar cambios"
                    : "Crear categoría"}
              </Button>
              {editingId && (
                <Button
                  disabled={isSaving}
                  onClick={cancelEditing}
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
          <CardTitle>Categorías existentes</CardTitle>
          <CardDescription>
            {categories.length}{" "}
            {categories.length === 1 ? "categoría" : "categorías"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">
              Cargando categorías…
            </p>
          ) : error && categories.length === 0 ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                onClick={() => window.location.reload()}
                type="button"
                variant="outline"
              >
                Reintentar
              </Button>
            </div>
          ) : categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Todavía no hay categorías. Crea la primera desde el formulario.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Nombre</th>
                    <th className="px-3 py-2 font-medium">Productos</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-3 font-medium">{category.name}</td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {category.productCount ?? 0}
                      </td>
                      <td className="px-3 py-3">
                        {pendingDeleteId === category.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-muted-foreground">
                              ¿Eliminar esta categoría?
                            </span>
                            <Button
                              disabled={deletingId === category.id}
                              onClick={() => void confirmDelete(category)}
                              size="sm"
                              type="button"
                              variant="destructive"
                            >
                              {deletingId === category.id
                                ? "Eliminando…"
                                : "Confirmar"}
                            </Button>
                            <Button
                              disabled={deletingId === category.id}
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
                              aria-label={`Editar ${category.name}`}
                              onClick={() => startEditing(category)}
                              size="icon-sm"
                              type="button"
                              variant="outline"
                            >
                              <Pencil aria-hidden="true" />
                            </Button>
                            {category.productCount ? (
                              <span className="text-xs text-muted-foreground">
                                No se puede eliminar: tiene productos
                              </span>
                            ) : (
                              <Button
                                aria-label={`Eliminar ${category.name}`}
                                onClick={() => setPendingDeleteId(category.id)}
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
