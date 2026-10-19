import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });

    return categories.map(({ _count, ...category }) => ({
      ...category,
      productCount: _count.products,
    }));
  }

  async create(name: string) {
    try {
      return await this.prisma.category.create({ data: { name } });
    } catch (error) {
      if (prismaErrorCode(error) === "P2002") {
        throw new ConflictException("Ya existe una categoría con ese nombre.");
      }
      throw error;
    }
  }

  async update(id: string, name: string) {
    try {
      return await this.prisma.category.update({
        where: { id },
        data: { name },
      });
    } catch (error) {
      const code = prismaErrorCode(error);
      if (code === "P2002") {
        throw new ConflictException("Ya existe una categoría con ese nombre.");
      }
      if (code === "P2025") {
        throw new NotFoundException("No se encontró la categoría.");
      }
      throw error;
    }
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: {
        id: true,
        _count: { select: { products: true } },
      },
    });
    if (!category) {
      throw new NotFoundException("No se encontró la categoría.");
    }
    if (category._count.products > 0) {
      throw new ConflictException(
        "No se puede eliminar la categoría porque tiene productos asociados.",
      );
    }

    try {
      await this.prisma.category.delete({ where: { id } });
      return { success: true };
    } catch (error) {
      const code = prismaErrorCode(error);
      if (code === "P2003") {
        throw new ConflictException(
          "No se puede eliminar la categoría porque tiene productos asociados.",
        );
      }
      if (code === "P2025") {
        throw new NotFoundException("No se encontró la categoría.");
      }
      throw error;
    }
  }
}
