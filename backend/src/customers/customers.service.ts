import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateCustomerInput,
  CustomerInput,
  CustomerListFilters,
} from "./customers.types";

function prismaErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }
  return typeof error.code === "string" ? error.code : null;
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: CustomerListFilters) {
    const where: Prisma.CustomerWhereInput = filters.search
      ? {
          OR: [
            {
              firstName: {
                contains: filters.search,
                mode: "insensitive",
              },
            },
            {
              lastName: {
                contains: filters.search,
                mode: "insensitive",
              },
            },
            { email: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {};
    const orderBy: Prisma.CustomerOrderByWithRelationInput[] =
      filters.sortBy === "firstName"
        ? [
            { firstName: filters.sortDirection },
            { lastName: filters.sortDirection },
            { id: filters.sortDirection },
          ]
        : [
            { [filters.sortBy]: filters.sortDirection },
            { lastName: "asc" },
            { firstName: "asc" },
            { id: "asc" },
          ];
    const [total, items] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
    ]);

    return {
      items,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.ceil(total / filters.pageSize),
    };
  }

  async get(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException("No se encontró el cliente.");
    }
    return customer;
  }

  async create(input: CreateCustomerInput) {
    try {
      return await this.prisma.customer.create({ data: input });
    } catch (error) {
      if (prismaErrorCode(error) === "P2002") {
        throw new ConflictException(
          "Ya existe un cliente registrado con ese email.",
        );
      }
      throw error;
    }
  }

  async update(id: string, input: CustomerInput) {
    try {
      return await this.prisma.customer.update({
        where: { id },
        data: input,
      });
    } catch (error) {
      const code = prismaErrorCode(error);
      if (code === "P2002") {
        throw new ConflictException(
          "Ya existe un cliente registrado con ese email.",
        );
      }
      if (code === "P2025") {
        throw new NotFoundException("No se encontró el cliente.");
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.customer.delete({ where: { id } });
      return { success: true };
    } catch (error) {
      const code = prismaErrorCode(error);
      if (code === "P2003") {
        throw new ConflictException(
          "No se puede eliminar el cliente porque tiene registros relacionados.",
        );
      }
      if (code === "P2025") {
        throw new NotFoundException("No se encontró el cliente.");
      }
      throw error;
    }
  }
}
