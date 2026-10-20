"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
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
  createCategory,
  deleteCategory,
  getCategories,
  getCategory,
  updateCategory,
  type Category,
} from "@/lib/api";

const MAX_CATEGORY_NAME_LENGTH = 100;

type SortColumn = "position" | "name" | "subcategoryCount" | "type";
type SortDirection = "asc" | "desc";

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
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

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<"main" | "sub">("main");
  const [parentId, setParentId] = useState("");
  const [position, setPosition] = useState("1");
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("position");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isSavingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const deleteErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleteError, setDeleteError] = useState<{
    categoryId: string;
    message: string;
  } | null>(null);

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

  useEffect(
    () => () => {
      if (deleteErrorTimerRef.current) {
        clearTimeout(deleteErrorTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isFormOpen) return;
    const dialog = dialogRef.current;
    const returnFocusTarget = document.activeElement;
    dialog
      ?.querySelector<HTMLElement>(
        "input:not(:disabled), select:not(:disabled), button:not(:disabled)",
      )
      ?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSavingRef.current) {
        setIsFormOpen(false);
        setError("");
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
      if (returnFocusTarget instanceof HTMLElement) returnFocusTarget.focus();
    };
  }, [isFormOpen]);

  const mainCategories = useMemo(
    () =>
      categories
        .filter((category) => !category.parentId)
          .sort(
            (a, b) =>
              a.position - b.position ||
              compareNames(a.name, b.name) ||
              a.id.localeCompare(b.id),
          ),
    [categories],
  );
  const visibleCategories = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const filtered = categories.filter((category) =>
      category.name.toLocaleLowerCase().includes(normalizedSearch),
    );
    const direction = sortDirection === "asc" ? 1 : -1;

    return filtered.sort((a, b) => {
      let primaryComparison = 0;
      if (sortColumn === "position") {
        primaryComparison = a.position - b.position;
      } else if (sortColumn === "name") {
        primaryComparison = compareNames(a.name, b.name);
      } else if (sortColumn === "subcategoryCount") {
        primaryComparison = a.subcategoryCount - b.subcategoryCount;
      } else {
        primaryComparison = Number(Boolean(a.parentId)) - Number(Boolean(b.parentId));
      }

      return (
        primaryComparison * direction ||
        compareNames(a.name, b.name) ||
        a.id.localeCompare(b.id)
      );
    });
  }, [categories, search, sortColumn, sortDirection]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setLevel("main");
    setParentId("");
    const maxPosition = categories.reduce(
      (highest, category) => Math.max(highest, category.position),
      0,
    );
    setPosition(String(maxPosition + 1));
    setIsFormOpen(false);
  }

  function startEditing(category: Category) {
    setPendingDeleteId(null);
    setExpandedId(null);
    clearDeleteError();
    setEditingId(category.id);
    setName(category.name);
    setLevel(category.parentId ? "sub" : "main");
    setParentId(category.parentId ?? "");
    setPosition(String(category.position));
    setError("");
    setNotice("");
    setIsFormOpen(true);
  }

  function openNewCategoryForm() {
    setPendingDeleteId(null);
    setExpandedId(null);
    clearDeleteError();
    resetForm();
    setError("");
    setNotice("");
    setIsFormOpen(true);
  }

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    setSortDirection("asc");
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

  async function handleDetails(categoryId: string) {
    setPendingDeleteId(null);
    clearDeleteError();
    if (expandedId === categoryId) {
      setExpandedId(null);
      return;
    }
    setError("");
    try {
      const details = await getCategory(categoryId);
      setCategories((current) =>
        current.map((category) =>
          category.id === details.id ? { ...category, ...details } : category,
        ),
      );
      setExpandedId(categoryId);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const normalizedName = name.trim();
    const parsedPosition = Number(position);
    if (
      normalizedName.length === 0 ||
      normalizedName.length > MAX_CATEGORY_NAME_LENGTH
    ) {
      setError(
        `El nombre debe tener entre 1 y ${MAX_CATEGORY_NAME_LENGTH} caracteres.`,
      );
      return;
    }
    if (!Number.isSafeInteger(parsedPosition) || parsedPosition < 1) {
      setError("La posición debe ser un número entero positivo.");
      return;
    }
    if (level === "sub" && !mainCategories.some((item) => item.id === parentId)) {
      setError("Selecciona una categoría principal existente.");
      return;
    }
    if (editingId) {
      const existing = categories.find((item) => item.id === editingId);
      if (
        existing &&
        ((existing.parentId && level === "main" && existing.productCount) ||
          (!existing.parentId &&
            level === "sub" &&
            (existing.subcategoryCount || existing.productCount)))
      ) {
        setError(
          "No se puede cambiar el nivel de una categoría que tiene productos o subcategorías dependientes.",
        );
        return;
      }
    }

    setIsSaving(true);
    isSavingRef.current = true;
    try {
      const input = {
        name: normalizedName,
        parentId: level === "sub" ? parentId : null,
        position: parsedPosition,
      };
      if (editingId) {
        await updateCategory(editingId, input);
        setNotice("Categoría actualizada.");
      } else {
        await createCategory(input);
        setNotice(
          level === "main" ? "Categoría principal creada." : "Subcategoría creada.",
        );
      }
      try {
        setCategories(await getCategories());
      } catch (refreshError) {
        setError(
          `La categoría se guardó, pero no se pudo actualizar el listado. ${getErrorMessage(refreshError)}`,
        );
      }
      resetForm();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  }

  async function confirmDelete(category: Category) {
    setError("");
    setNotice("");
    clearDeleteError();
    setDeletingId(category.id);
    try {
      await deleteCategory(category.id);
      setPendingDeleteId(null);
      setExpandedId(null);
      setNotice("Categoría eliminada.");
      try {
        setCategories(await getCategories());
      } catch (refreshError) {
        setError(
          `La categoría se eliminó, pero no se pudo actualizar el listado. ${getErrorMessage(refreshError)}`,
        );
      }
    } catch (requestError) {
      setPendingDeleteId(null);
      const message = getErrorMessage(requestError);
      const hasAssignedProducts =
        (category.productCount ?? 0) > 0 || /productos/i.test(message);
      setDeleteError({
        categoryId: category.id,
        message:
          hasAssignedProducts &&
          requestError instanceof ApiError &&
          requestError.status === 409
            ? "No se puede eliminar porque la categoría tiene productos asignados."
            : message,
      });
      deleteErrorTimerRef.current = setTimeout(() => {
        setDeleteError(null);
        deleteErrorTimerRef.current = null;
      }, 10_000);
    } finally {
      setDeletingId(null);
    }
  }

  function clearDeleteError() {
    if (deleteErrorTimerRef.current) {
      clearTimeout(deleteErrorTimerRef.current);
      deleteErrorTimerRef.current = null;
    }
    setDeleteError(null);
  }

  return (
    <section aria-labelledby="categories-title" className="min-w-0 max-w-full space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            id="categories-title"
            className="text-xl font-semibold tracking-tight"
          >
            Categorías
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organiza el catálogo en categorías principales y subcategorías.
          </p>
        </div>
        <Button disabled={isLoading} onClick={openNewCategoryForm} type="button">
          <Plus aria-hidden="true" data-icon="inline-start" />
          Nueva categoría
        </Button>
      </div>

      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSavingRef.current) {
              resetForm();
              setError("");
              setError("");
            }
          }}
        >
          <div
            aria-labelledby="category-form-title"
            aria-modal="true"
            className="my-3 w-full max-w-3xl"
            ref={dialogRef}
            role="dialog"
          >
        <Card className="rounded-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <CardTitle id="category-form-title">{editingId ? "Editar categoría" : "Nueva categoría"}</CardTitle>
                <CardDescription>
                  La jerarquía admite categorías principales y un solo nivel de
                  subcategorías.
                </CardDescription>
              </div>
              <Button
                aria-label="Cerrar formulario"
                disabled={isSaving}
                onClick={() => {
                  resetForm();
                  setError("");
                }}
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
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={handleSave}
              noValidate
            >
              <div className="space-y-1.5">
                <label htmlFor="category-level" className="text-sm font-medium">
                  Nivel
                </label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={isSaving}
                  id="category-level"
                  onChange={(event) => {
                    setLevel(event.target.value as "main" | "sub");
                    setParentId("");
                  }}
                  value={level}
                >
                  <option value="main">Principal</option>
                  <option value="sub">Subcategoría</option>
                </select>
              </div>
              {level === "sub" && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="category-parent"
                    className="text-sm font-medium"
                  >
                    Categoría padre
                  </label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    disabled={isSaving}
                    id="category-parent"
                    onChange={(event) => setParentId(event.target.value)}
                    required
                    value={parentId}
                  >
                    <option value="">Selecciona categoría principal</option>
                    {mainCategories
                      .filter((item) => item.id !== editingId)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="category-name" className="text-sm font-medium">
                  Nombre
                </label>
                <input
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  disabled={isSaving}
                  id="category-name"
                  maxLength={MAX_CATEGORY_NAME_LENGTH}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="category-position"
                  className="text-sm font-medium"
                >
                  Posición
                </label>
                <input
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  disabled={isSaving}
                  id="category-position"
                  min={1}
                  onChange={(event) => setPosition(event.target.value)}
                  required
                  type="number"
                  value={position}
                />
              </div>
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
                <Button disabled={isSaving} type="submit">
                  <Plus aria-hidden="true" data-icon="inline-start" />
                  {isSaving
                    ? "Guardando…"
                    : editingId
                      ? "Guardar cambios"
                      : "Crear categoría"}
                </Button>
                {editingId && (
                  <Button
                    disabled={isSaving}
                    onClick={() => {
                      resetForm();
                      setError("");
                    }}
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
          </CardContent>
        </Card>
          </div>
        </div>
      )}

      {!isFormOpen && error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      <Card className="min-w-0 max-w-full rounded-lg">
        <CardHeader>
          <CardTitle>Categorías existentes</CardTitle>
          <CardDescription>
            {categories.length} {categories.length === 1 ? "registro" : "registros"}
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 max-w-full">
          <label className="relative mb-4 block max-w-sm">
            <span className="sr-only">Buscar por nombre</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre…"
              type="search"
              value={search}
            />
          </label>
          {isLoading ? (
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">
              Cargando categorías…
            </p>
          ) : error && categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{error}</p>
          ) : categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay categorías cargadas.
            </p>
          ) : visibleCategories.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No se encontraron categorías con ese nombre.
            </p>
          ) : (
            <div
              aria-label="Tabla de categorías"
              className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain"
              tabIndex={0}
            >
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    {renderSortHeader("Posición", "position")}
                    {renderSortHeader("Nombre", "name")}
                    {renderSortHeader("Subcategorías", "subcategoryCount")}
                    <th className="px-3 py-2 font-medium">Categoría padre</th>
                    <th className="px-3 py-2 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCategories.map((category) => (
                    <Fragment key={category.id}>
                      <tr
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-3 py-3">{category.position}</td>
                        <td className="px-3 py-3 font-medium">{category.name}</td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {category.subcategoryCount}
                        </td>
                        <td className="px-3 py-3">
                          {category.parentId ? (
                            <span
                              className="inline-flex max-w-full truncate rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800"
                              title={category.parent?.name ?? "Categoría padre no disponible"}
                            >
                              {category.parent?.name ?? "—"}
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                              Principal
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              aria-label={`Consultar ${category.name}`}
                              onClick={() => void handleDetails(category.id)}
                              size="icon-sm"
                              type="button"
                              variant="outline"
                            >
                              <Eye aria-hidden="true" className="text-blue-600" />
                            </Button>
                            <Button
                              aria-label={`Editar ${category.name}`}
                              onClick={() => startEditing(category)}
                              size="icon-sm"
                              type="button"
                              variant="outline"
                            >
                              <Pencil aria-hidden="true" />
                            </Button>
                            <Button
                              aria-label={`Eliminar ${category.name}`}
                              disabled={
                                deletingId === category.id ||
                                (category.subcategoryCount > 0 &&
                                  (category.productCount ?? 0) === 0)
                              }
                              onClick={() => {
                                setExpandedId(null);
                                clearDeleteError();
                                setPendingDeleteId(category.id);
                              }}
                              size="icon-sm"
                              type="button"
                              variant="outline"
                            >
                              <Trash2 aria-hidden="true" className="text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {(expandedId === category.id ||
                        pendingDeleteId === category.id ||
                        deleteError?.categoryId === category.id) && (
                        <tr className="border-b border-border" key={`${category.id}-panel`}>
                          <td className="px-3 py-3" colSpan={5}>
                            <div className="rounded-md border-l-2 border-primary bg-muted/40 px-3 py-3 sm:px-4">
                              <p className="mb-2 text-xs font-semibold">
                                {category.parentId ? "Subcategoría" : "Categoría"}: {category.name}
                              </p>
                              {expandedId === category.id && (
                                <p className="text-xs text-muted-foreground">
                                  {category.parent
                                    ? `Subcategoría de ${category.parent.name}.`
                                    : category.children?.length
                                      ? `Subcategorías: ${category.children
                                          .map((child) => child.name)
                                          .join(", ")}.`
                                      : "Categoría principal sin subcategorías."}
                                  {category.productCount
                                    ? ` Productos asociados: ${category.productCount}.`
                                    : ""}
                                </p>
                              )}
                              {pendingDeleteId === category.id && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="mr-auto text-sm">
                                    ¿Eliminar “{category.name}”?
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
                              )}
                              {deleteError?.categoryId === category.id && (
                                <p className="text-sm text-destructive" role="alert">
                                  {deleteError.message}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
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
