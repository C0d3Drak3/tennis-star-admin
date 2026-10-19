export interface AuthUser {
  id: string;
  email: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message = "The API request failed.",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function getApiUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }
  return `${baseUrl}${path}`;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(getApiUrl(path), {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let message = "La solicitud no pudo completarse.";
    if (response.status < 500) {
      try {
        const payload: unknown = await response.json();
        if (typeof payload === "object" && payload !== null && "message" in payload) {
          const apiMessage = payload.message;
          if (typeof apiMessage === "string") {
            message = apiMessage;
          } else if (
            Array.isArray(apiMessage) &&
            apiMessage.every((item) => typeof item === "string")
          ) {
            message = apiMessage.join(" ");
          }
        }
      } catch {
        message = "La solicitud no pudo completarse.";
      }
    }
    throw new ApiError(response.status, message);
  }

  return response.json() as Promise<T>;
}

function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const user = value as Record<string, unknown>;
  return typeof user.id === "string" && typeof user.email === "string";
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const user = await request<unknown>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!isAuthUser(user)) {
    throw new Error("The API returned an invalid user response.");
  }
  return user;
}

export async function getCurrentUser(
  signal?: AbortSignal,
): Promise<AuthUser | null> {
  try {
    const user = await request<unknown>("/auth/me", { signal });
    if (!isAuthUser(user)) {
      throw new Error("The API returned an invalid user response.");
    }
    return user;
  } catch (error) {
    if (signal?.aborted && isAbortError(error)) {
      return null;
    }
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function logout(): Promise<void> {
  await request<{ success: boolean }>("/auth/logout", { method: "POST" });
}

export interface Category {
  id: string;
  name: string;
  position: number;
  parentId: string | null;
  parent: Pick<Category, "id" | "name"> | null;
  subcategoryCount: number;
  children?: Pick<Category, "id" | "name" | "position">[];
  createdAt: string;
  updatedAt: string;
  productCount?: number;
}

export interface CategoryInput {
  name: string;
  parentId: string | null;
  position?: number;
}

export function getCategories(): Promise<Category[]> {
  return request<Category[]>("/categories");
}

export function getCategory(id: string): Promise<Category> {
  return request<Category>(`/categories/${encodeURIComponent(id)}`);
}

export function createCategory(input: CategoryInput): Promise<Category> {
  return request<Category>("/categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCategory(
  id: string,
  input: Partial<CategoryInput>,
): Promise<Category> {
  return request<Category>(`/categories/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteCategory(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(
    `/categories/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string;
  isActive: boolean;
  brandId: string;
  brand: Pick<Brand, "id" | "name">;
  categoryId: string;
  category: Pick<Category, "id" | "name">;
  subcategoryId: string | null;
  subcategory: Pick<Category, "id" | "name"> | null;
  stock: number;
  saleItemCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  name: string;
  price: string;
  description: string | null;
  brandId: string;
  categoryId: string;
  subcategoryId: string | null;
  stock: number;
}

export interface ProductList {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  brandId?: string;
  isActive?: "true" | "false" | "";
  page?: number;
  pageSize?: number;
  sortBy?: "category" | "brand" | "stock" | "price" | "status" | "name";
  sortDirection?: "asc" | "desc";
}

export function getProducts(filters: ProductFilters = {}): Promise<ProductList> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return request<ProductList>(`/products${suffix}`);
}

function productFormData(input: Partial<ProductInput>, image: File): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(input)) {
    formData.append(key, value === null ? "" : String(value));
  }
  formData.append("image", image);
  return formData;
}

export function createProduct(
  input: ProductInput,
  image: File,
): Promise<Product> {
  return request<Product>("/products", {
    method: "POST",
    body: productFormData(input, image),
  });
}

export function updateProduct(
  id: string,
  input: Partial<ProductInput> & { isActive?: boolean },
  image?: File,
): Promise<Product> {
  return request<Product>(`/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: image ? productFormData(input, image) : JSON.stringify(input),
  });
}

export interface Brand {
  id: string;
  name: string;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export function getBrands(): Promise<Brand[]> {
  return request<Brand[]>("/brands");
}

export function getBrand(id: string): Promise<Brand> {
  return request<Brand>(`/brands/${encodeURIComponent(id)}`);
}

export function createBrand(name: string): Promise<Brand> {
  return request<Brand>("/brands", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function updateBrand(id: string, name: string): Promise<Brand> {
  return request<Brand>(`/brands/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteBrand(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(
    `/brands/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export function getProductImageUrl(imageUrl: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }
  return new URL(imageUrl, new URL(baseUrl).origin).toString();
}

export function deleteProduct(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(
    `/products/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}
