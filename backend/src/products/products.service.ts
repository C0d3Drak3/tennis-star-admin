import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateProductInput,
  ProductInput,
} from "./products.types";

function prismaErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }
  return typeof error.code === "string" ? error.code : null;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.product.findMany({
      orderBy: { name: "asc" },
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { saleItems: true } },
      },
    }).then((products) =>
      products.map(({ _count, ...product }) => ({
        ...product,
        saleItemCount: _count.saleItems,
      })),
    );
  }

  async create(input: CreateProductInput) {
    await this.ensureCategoryExists(input.categoryId);
    try {
      return await this.prisma.product.create({
        data: {
          name: input.name,
          price: input.price,
          categoryId: input.categoryId,
          description: input.description ?? null,
        },
        include: { category: { select: { id: true, name: true } } },
      });
    } catch (error) {
      if (prismaErrorCode(error) === "P2003") {
        throw new NotFoundException("No se encontró la categoría seleccionada.");
      }
      throw error;
    }
  }

  async update(id: string, input: ProductInput) {
    if (input.categoryId) {
      await this.ensureCategoryExists(input.categoryId);
    }
    try {
      return await this.prisma.product.update({
        where: { id },
        data: input,
        include: { category: { select: { id: true, name: true } } },
      });
    } catch (error) {
      const code = prismaErrorCode(error);
      if (code === "P2025") {
        throw new NotFoundException("No se encontró el producto.");
      }
      if (code === "P2003") {
        throw new NotFoundException("No se encontró la categoría seleccionada.");
      }
      throw error;
    }
  }

  async remove(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        _count: { select: { saleItems: true } },
      },
    });
    if (!product) {
      throw new NotFoundException("No se encontró el producto.");
    }
    if (product._count.saleItems > 0) {
      throw new ConflictException(
        "No se puede eliminar físicamente este producto porque está asociado a ventas. Desactívalo para retirarlo del catálogo.",
      );
    }

    try {
      await this.prisma.product.delete({ where: { id } });
      return { success: true };
    } catch (error) {
      const code = prismaErrorCode(error);
      if (code === "P2003") {
        throw new ConflictException(
          "No se puede eliminar físicamente este producto porque está asociado a ventas. Desactívalo para retirarlo del catálogo.",
        );
      }
      if (code === "P2025") {
        throw new NotFoundException("No se encontró el producto.");
      }
      throw error;
    }
  }

  private async ensureCategoryExists(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException("No se encontró la categoría seleccionada.");
    }
  }
}
