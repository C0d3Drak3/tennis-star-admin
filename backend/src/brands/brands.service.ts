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
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.brand.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    }).then((brands) =>
      brands.map(({ _count, ...brand }) => ({
        ...brand,
        productCount: _count.products,
      })),
    );
  }

  async get(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!brand) {
      throw new NotFoundException("No se encontró la marca.");
    }
    const { _count, ...result } = brand;
    return { ...result, productCount: _count.products };
  }

  async create(input: { name: string }) {
    try {
      return await this.prisma.brand.create({ data: input });
    } catch (error) {
      if (prismaErrorCode(error) === "P2002") {
        throw new ConflictException("Ya existe una marca con ese nombre.");
      }
      throw error;
    }
  }

  async update(id: string, input: { name: string }) {
    try {
      return await this.prisma.brand.update({
        where: { id },
        data: input,
      });
    } catch (error) {
      const code = prismaErrorCode(error);
      if (code === "P2002") {
        throw new ConflictException("Ya existe una marca con ese nombre.");
      }
      if (code === "P2025") {
        throw new NotFoundException("No se encontró la marca.");
      }
      throw error;
    }
  }

  async remove(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      select: {
        id: true,
        _count: { select: { products: true } },
      },
    });
    if (!brand) {
      throw new NotFoundException("No se encontró la marca.");
    }
    if (brand._count.products > 0) {
      throw new ConflictException(
        "No se puede eliminar la marca porque tiene productos asociados.",
      );
    }
    try {
      await this.prisma.brand.delete({ where: { id } });
      return { success: true };
    } catch (error) {
      const code = prismaErrorCode(error);
      if (code === "P2003") {
        throw new ConflictException(
          "No se puede eliminar la marca porque tiene productos asociados.",
        );
      }
      if (code === "P2025") {
        throw new NotFoundException("No se encontró la marca.");
      }
      throw error;
    }
  }
}
