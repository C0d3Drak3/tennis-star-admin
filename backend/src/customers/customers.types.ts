export interface CustomerInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  shippingAddress?: string;
  city?: string;
  postalCode?: string;
}

export interface CreateCustomerInput extends CustomerInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  shippingAddress: string;
  city: string;
  postalCode: string;
}

export type CustomerSortColumn =
  | "firstName"
  | "lastName"
  | "email"
  | "city"
  | "createdAt";
export type SortDirection = "asc" | "desc";

export interface CustomerListFilters {
  search?: string;
  page: number;
  pageSize: number;
  sortBy: CustomerSortColumn;
  sortDirection: SortDirection;
}
