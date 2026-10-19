import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  ImageStorageService,
  type UploadedProductImage,
} from "./image-storage.service";
import type {
  CreateProductInput,
  ProductInput,
  ProductListFilters,
} from "./products.types";

function prismaErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }
  return typeof error.code === "string" ? error.code : null;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageStorage: ImageStorageService,
  ) {}

  async list(filters: ProductListFilters) {
    const direction = filters.sortDirection;
    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      filters.sortBy === "category"
        ? [{ category: { name: direction } }, { name: "asc" }, { id: "asc" }]
        : filters.sortBy === "brand"
          ? [{ brand: { name: direction } }, { name: "asc" }, { id: "asc" }]
          : filters.sortBy === "stock"
            ? [{ stock: direction }, { name: "asc" }, { id: "asc" }]
            : filters.sortBy === "price"
              ? [{ price: direction }, { name: "asc" }, { id: "asc" }]
              : filters.sortBy === "status"
                ? [
                    { isActive: direction },
                    { name: "asc" },
                    { id: "asc" },
                  ]
                : [{ name: direction }, { id: "asc" }];
    const where: Prisma.ProductWhereInput = {
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              {
                description: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.brandId ? { brandId: filters.brandId } : {}),
      ...(filters.isActive === undefined
        ? {}
        : { isActive: filters.isActive }),
    };
    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        include: {
          brand: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true } },
          _count: {
            select: { saleItems: true },
          },
        },
      }),
    ]);
    const activeSaleItems = items.length
      ? await this.prisma.saleItem.groupBy({
          by: ["productId"],
          where: {
            productId: { in: items.map((product) => product.id) },
            sale: { status: "PREPARING", stockDeducted: true },
          },
          _count: { _all: true },
        })
      : [];
    const activeCountByProduct = new Map(
      activeSaleItems.map((entry) => [entry.productId, entry._count._all]),
    );

    return {
      items: items.map(({ _count, ...product }) => ({
        ...product,
        saleItemCount: _count.saleItems,
        activeSaleItemCount: activeCountByProduct.get(product.id) ?? 0,
      })),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.ceil(total / filters.pageSize),
    };
  }

  async create(input: CreateProductInput, image: UploadedProductImage) {
    await this.ensureReferences(input);
    const imageUrl = await this.imageStorage.save(image);
    try {
      return await this.prisma.product.create({
        data: {
          name: input.name,
          price: input.price,
          categoryId: input.categoryId,
          subcategoryId: input.subcategoryId ?? null,
          brandId: input.brandId,
          stock: input.stock,
          description: input.description ?? null,
          imageUrl,
        },
        include: {
          brand: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true } },
        },
      });
    } catch (error) {
      await this.imageStorage.removeIfUnreferenced(imageUrl);
      this.rethrowReferenceError(error);
    }
  }

  async update(
    id: string,
    input: ProductInput,
    image?: UploadedProductImage,
  ) {
    const current = await this.prisma.product.findUnique({
      where: { id },
      select: {
        imageUrl: true,
        brandId: true,
        categoryId: true,
        subcategoryId: true,
      },
    });
    if (!current) {
      throw new NotFoundException("No se encontró el producto.");
    }
    await this.ensureReferences({
      brandId: input.brandId ?? current.brandId,
      categoryId: input.categoryId ?? current.categoryId,
      subcategoryId: Object.hasOwn(input, "subcategoryId")
        ? input.subcategoryId
        : current.subcategoryId,
    });
    const nextImageUrl = image ? await this.imageStorage.save(image) : undefined;
    try {
      const updated = await this.prisma.product.update({
        where: { id },
        data: {
          ...input,
          ...(nextImageUrl ? { imageUrl: nextImageUrl } : {}),
        },
        include: {
          brand: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true } },
        },
      });
      if (nextImageUrl && nextImageUrl !== current.imageUrl) {
        await this.imageStorage.removeIfUnreferenced(current.imageUrl);
      }
      return updated;
    } catch (error) {
      if (nextImageUrl) {
        await this.imageStorage.removeIfUnreferenced(nextImageUrl);
      }
      this.rethrowReferenceError(error);
    }
  }

  async remove(id: string) {
    try {
      const imageUrl = await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ id: string; imageUrl: string }[]>`
          SELECT "id", "imageUrl" FROM "Product" WHERE "id" = ${id} FOR UPDATE
        `;
        if (locked.length === 0) {
          throw new NotFoundException("No se encontró el producto.");
        }
        const activeSale = await tx.saleItem.findFirst({
          where: {
            productId: id,
            sale: { status: "PREPARING", stockDeducted: true },
          },
          select: { id: true },
        });
        if (activeSale) {
          throw new ConflictException(
            "No se puede eliminar este producto porque una orden En preparación todavía depende de su inventario.",
          );
        }
        await tx.product.delete({ where: { id } });
        return locked[0].imageUrl;
      });
      await this.imageStorage.removeIfUnreferenced(imageUrl);
      return { success: true };
    } catch (error) {
      const code = prismaErrorCode(error);
      if (code === "P2003") {
        throw new ConflictException(
          "No se puede eliminar este producto porque tiene registros relacionados.",
        );
      }
      if (code === "P2025") {
        throw new NotFoundException("No se encontró el producto.");
      }
      throw error;
    }
  }

  private async ensureReferences(input: ProductInput) {
    if (!input.brandId || !input.categoryId) {
      throw new BadRequestException("Debes seleccionar una marca y categoría.");
    }
    const brand = await this.prisma.brand.findUnique({
      where: { id: input.brandId },
      select: { id: true },
    });
    if (!brand) {
      throw new NotFoundException("No se encontró la marca seleccionada.");
    }

    const category = await this.prisma.category.findUnique({
      where: { id: input.categoryId },
      select: { id: true, parentId: true },
    });
    if (!category) {
      throw new NotFoundException(
        "No se encontró la categoría principal seleccionada.",
      );
    }
    if (category.parentId !== null) {
      throw new BadRequestException(
        "Debes seleccionar una categoría principal, no una subcategoría.",
      );
    }
    if (input.subcategoryId) {
      const subcategory = await this.prisma.category.findUnique({
        where: { id: input.subcategoryId },
        select: { id: true, parentId: true },
      });
      if (!subcategory) {
        throw new NotFoundException("No se encontró la subcategoría.");
      }
      if (subcategory.parentId !== input.categoryId) {
        throw new BadRequestException(
          "La subcategoría debe pertenecer a la categoría principal seleccionada.",
        );
      }
    }
  }

  private rethrowReferenceError(error: unknown): never {
    const code = prismaErrorCode(error);
    if (code === "P2003") {
      throw new NotFoundException(
        "La marca o categoría seleccionada ya no existe.",
      );
    }
    if (code === "P2025") {
      throw new NotFoundException("No se encontró el producto.");
    }
    if (
      error instanceof Error &&
      error.message.includes("Product_category_hierarchy_trigger")
    ) {
      throw new BadRequestException(
        "La subcategoría debe pertenecer a la categoría principal seleccionada.",
      );
    }
    throw error;
  }
}
