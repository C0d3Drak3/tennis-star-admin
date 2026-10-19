import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "../generated/prisma/enums";

export interface SaleItemInput {
  productId: string;
  quantity: number;
  unitPrice?: string;
}

export interface SaleInput {
  customerId: string | null;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  shippingAddress: string;
  shippingCity: string;
  shippingPostalCode: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  operationalNotes?: string | null;
  items: SaleItemInput[];
}

export interface SaleUpdateInput extends SaleInput {
  items: (SaleItemInput & { unitPrice: string })[];
}

export interface SaleOperationalInput {
  carrier?: string | null;
  trackingNumber?: string | null;
  operationalNotes?: string | null;
  note?: string | null;
}

export interface SaleListFilters {
  search?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  page: number;
  pageSize: number;
  sortBy: "customer" | "orderNumber" | "status" | "total" | "payment" | "createdAt";
  sortDirection: "asc" | "desc";
}

export interface SaleActor {
  id: string;
  email: string;
}
