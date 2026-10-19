export interface ProductInput {
  name?: string;
  price?: string;
  description?: string | null;
  categoryId?: string;
  isActive?: boolean;
}

export interface CreateProductInput extends ProductInput {
  name: string;
  price: string;
  categoryId: string;
}
