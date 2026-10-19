import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CategoryInput } from "./categories.types";

function prismaErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }
  return typeof error.code === "string" ? error.code : null;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ parentId: "asc" }, { position: "asc" }, { name: "asc" }],
      include: {
        parent: { select: { id: true, name: true } },
        _count: {
          select: { children: true, products: true, subProducts: true },
        },
      },
    });

    return categories.map(({ _count, ...category }) => ({
      ...category,
      subcategoryCount: _count.children,
      productCount: _count.products + _count.subProducts,
    }));
  }

  async get(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true } },
        children: {
          orderBy: [{ position: "asc" }, { name: "asc" }],
          select: { id: true, name: true, position: true },
        },
        _count: {
          select: { products: true, subProducts: true },
        },
      },
    });
    if (!category) {
      throw new NotFoundException("No se encontró la categoría.");
    }
    const { _count, ...result } = category;
    return { ...result, productCount: _count.products + _count.subProducts };
  }

  async create(input: CategoryInput) {
    const name = input.name;
    if (!name) {
      throw new BadRequestException("El nombre de la categoría es obligatorio.");
    }
    await this.ensureParentIsMain(input.parentId ?? null);
    const position = input.position ?? (await this.nextPosition(input.parentId ?? null));
    try {
      return await this.prisma.category.create({
        data: { name, parentId: input.parentId ?? null, position },
      });
    } catch (error) {
      if (prismaErrorCode(error) === "P2002") {
        throw new ConflictException("Ya existe una categoría con ese nombre.");
      }
      if (prismaErrorCode(error) === "P2003") {
        throw new NotFoundException("No se encontró la categoría padre.");
      }
      throw error;
    }
  }

  async update(id: string, input: CategoryInput) {
    const current = await this.prisma.category.findUnique({
      where: { id },
      select: {
        id: true,
        parentId: true,
        _count: { select: { children: true, products: true, subProducts: true } },
      },
    });
    if (!current) {
      throw new NotFoundException("No se encontró la categoría.");
    }
    const parentId =
      "parentId" in input ? input.parentId ?? null : current.parentId;
    if (parentId !== current.parentId) {
      if (parentId === current.id) {
        throw new BadRequestException("Una categoría no puede ser su propio padre.");
      }
      if (
        current.parentId === null &&
        parentId !== null &&
        (current._count.children > 0 ||
          current._count.products > 0 ||
          current._count.subProducts > 0)
      ) {
        throw new ConflictException(
          "No se puede convertir en subcategoría porque tiene productos o subcategorías dependientes.",
        );
      }
      if (
        current.parentId !== null &&
        parentId === null &&
        current._count.subProducts > 0
      ) {
        throw new ConflictException(
          "No se puede convertir en categoría principal porque tiene productos asociados.",
        );
      }
      if (
        current.parentId !== null &&
        parentId !== null &&
        parentId !== current.parentId &&
        current._count.subProducts > 0
      ) {
        throw new ConflictException(
          "No se puede cambiar la categoría padre porque hay productos asociados a esta subcategoría.",
        );
      }
      await this.ensureParentIsMain(parentId);
    }
    try {
      return await this.prisma.category.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...("parentId" in input ? { parentId } : {}),
          ...(input.position !== undefined ? { position: input.position } : {}),
        },
      });
    } catch (error) {
      const code = prismaErrorCode(error);
      if (code === "P2002") {
        throw new ConflictException("Ya existe una categoría con ese nombre.");
      }
      if (code === "P2025") {
        throw new NotFoundException("No se encontró la categoría.");
      }
      if (code === "P2003") {
        throw new NotFoundException("No se encontró la categoría padre.");
      }
      throw error;
    }
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: {
        id: true,
        _count: {
          select: { children: true, products: true, subProducts: true },
        },
      },
    });
    if (!category) {
      throw new NotFoundException("No se encontró la categoría.");
    }
    if (
      category._count.children > 0 ||
      category._count.products > 0 ||
      category._count.subProducts > 0
    ) {
      throw new ConflictException(
        "No se puede eliminar la categoría porque tiene productos o subcategorías asociados.",
      );
    }

    try {
      await this.prisma.category.delete({ where: { id } });
      return { success: true };
    } catch (error) {
      const code = prismaErrorCode(error);
      if (code === "P2003") {
        throw new ConflictException(
          "No se puede eliminar la categoría porque tiene productos o subcategorías asociados.",
        );
      }
      if (code === "P2025") {
        throw new NotFoundException("No se encontró la categoría.");
      }
      throw error;
    }
  }

  private async ensureParentIsMain(parentId: string | null) {
    if (!parentId) {
      return;
    }
    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true },
    });
    if (!parent) {
      throw new NotFoundException("No se encontró la categoría padre.");
    }
    if (parent.parentId !== null) {
      throw new BadRequestException(
        "Una subcategoría no puede tener subcategorías propias.",
      );
    }
  }

  private async nextPosition(parentId: string | null) {
    const lastCategory = await this.prisma.category.findFirst({
      where: { parentId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (lastCategory?.position ?? 0) + 1;
  }
}
