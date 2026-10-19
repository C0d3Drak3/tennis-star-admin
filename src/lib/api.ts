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

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  shippingAddress: string;
  city: string;
  postalCode: string;
  createdAt: string;
  updatedAt: string;
}

export type CustomerInput = Omit<
  Customer,
  "id" | "createdAt" | "updatedAt"
>;

export interface CustomerList {
  items: Customer[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CustomerFilters {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "firstName" | "lastName" | "email" | "city" | "createdAt";
  sortDirection?: "asc" | "desc";
}

export function getCustomers(
  filters: CustomerFilters = {},
): Promise<CustomerList> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return request<CustomerList>(`/customers${suffix}`);
}

export function getCustomer(id: string): Promise<Customer> {
  return request<Customer>(`/customers/${encodeURIComponent(id)}`);
}

export function createCustomer(input: CustomerInput): Promise<Customer> {
  return request<Customer>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCustomer(
  id: string,
  input: Partial<CustomerInput>,
): Promise<Customer> {
  return request<Customer>(`/customers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteCustomer(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(
    `/customers/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export type SaleOrderStatus = "PREPARING" | "SHIPPED" | "CANCELLED";
export type SalePaymentStatus = "PAID" | "FAILED";
export type SalePaymentMethod = "CASH" | "CARD";

export interface SaleItem {
  id: string;
  productId: string | null;
  productIdSnapshot: string | null;
  productName: string;
  productDescription: string | null;
  brandName: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
  quantity: number;
  unitPrice: string;
  subtotal: string;
}

export interface SaleHistoryEntry {
  id: string;
  actorEmail: string;
  event: string;
  changes: Record<string, unknown>;
  note: string | null;
  createdAt: string;
}

export interface Sale {
  id: string;
  orderNumber: string;
  customerId: string | null;
  customerIdSnapshot: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  operationalNotes: string | null;
  paymentMethod: SalePaymentMethod | null;
  paymentStatus: SalePaymentStatus;
  status: SaleOrderStatus;
  stockDeducted: boolean;
  total: string;
  items: SaleItem[];
  history?: SaleHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface SaleInput {
  customerId: string | null;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  paymentMethod: SalePaymentMethod;
  paymentStatus: SalePaymentStatus;
  shippingAddress: string;
  shippingCity: string;
  shippingPostalCode: string;
  carrier: string | null;
  trackingNumber: string | null;
  operationalNotes: string | null;
  items: { productId: string; quantity: number; unitPrice?: string }[];
}

export interface SaleList {
  items: Sale[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SaleFilters {
  search?: string;
  status?: SaleOrderStatus | "";
  paymentStatus?: SalePaymentStatus | "";
  page?: number;
  pageSize?: number;
  sortBy?: "customer" | "orderNumber" | "status" | "total" | "payment" | "createdAt";
  sortDirection?: "asc" | "desc";
}

function queryString(filters: object): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return query.size ? `?${query.toString()}` : "";
}

export function getSales(filters: SaleFilters = {}): Promise<SaleList> {
  return request<SaleList>(`/sales${queryString(filters)}`);
}

export function getSale(id: string): Promise<Sale> {
  return request<Sale>(`/sales/${encodeURIComponent(id)}`);
}

export function createSale(input: SaleInput, idempotencyKey: string): Promise<Sale> {
  return request<Sale>("/sales", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  });
}

export function updateSale(id: string, input: SaleInput): Promise<Sale> {
  return request<Sale>(`/sales/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function reactivateSale(id: string, input: SaleInput): Promise<Sale> {
  return request<Sale>(`/sales/${encodeURIComponent(id)}/reactivate`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function cancelSale(id: string, note?: string): Promise<Sale> {
  return request<Sale>(`/sales/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export function updateSalePayment(
  id: string,
  paymentStatus: SalePaymentStatus,
  note?: string,
): Promise<Sale> {
  return request<Sale>(`/sales/${encodeURIComponent(id)}/payment`, {
    method: "PATCH",
    body: JSON.stringify({ paymentStatus, note }),
  });
}

export function completeSale(
  id: string,
  input: {
    carrier: string | null;
    trackingNumber: string | null;
    operationalNotes: string | null;
    note: string | null;
  },
): Promise<Sale> {
  return request<Sale>(`/sales/${encodeURIComponent(id)}/complete`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSaleOperations(
  id: string,
  input: {
    carrier: string | null;
    trackingNumber: string | null;
    operationalNotes: string | null;
    note: string | null;
  },
): Promise<Sale> {
  return request<Sale>(`/sales/${encodeURIComponent(id)}/operations`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
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
  activeSaleItemCount?: number;
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
