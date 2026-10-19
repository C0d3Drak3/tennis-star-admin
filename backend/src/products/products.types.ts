export interface ProductInput {
  name?: string;
  price?: string;
  description?: string | null;
  brandId?: string;
  categoryId?: string;
  subcategoryId?: string | null;
  stock?: number;
  isActive?: boolean;
}

export interface CreateProductInput extends ProductInput {
  name: string;
  price: string;
  brandId: string;
  categoryId: string;
  stock: number;
}

export type ProductSortColumn =
  | "category"
  | "brand"
  | "stock"
  | "price"
  | "status"
  | "name";
export type SortDirection = "asc" | "desc";

export interface ProductListFilters {
  search?: string;
  categoryId?: string;
  brandId?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
  sortBy: ProductSortColumn;
  sortDirection: SortDirection;
}
