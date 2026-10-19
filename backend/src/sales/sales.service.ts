import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type PaymentStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  SaleActor,
  SaleInput,
  SaleListFilters,
  SaleOperationalInput,
  SaleUpdateInput,
} from "./sales.types";

const saleInclude = {
  items: { orderBy: { id: "asc" as const } },
  history: { orderBy: { createdAt: "desc" as const } },
};

function prismaErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }
  return typeof error.code === "string" ? error.code : null;
}

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function moneyTotal(
  items: { quantity: number; unitPrice: Prisma.Decimal }[],
): Prisma.Decimal {
  const maxMoney = new Prisma.Decimal("9999999999.99");
  const total = items.reduce((sum, item) => {
    const subtotal = item.unitPrice.mul(item.quantity).toDecimalPlaces(2);
    if (subtotal.greaterThan(maxMoney)) {
      throw new BadRequestException("El subtotal de una línea supera el máximo permitido.");
    }
    return sum.plus(subtotal);
  }, new Prisma.Decimal(0));
  if (total.greaterThan(maxMoney)) {
    throw new BadRequestException("El total de la orden supera el máximo permitido.");
  }
  return total;
}

function historyChanges(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function fullCustomerName(customer: { firstName: string; lastName: string }): string {
  return `${customer.firstName} ${customer.lastName}`.trim();
}

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: SaleListFilters) {
    const where: Prisma.SaleWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
      ...(filters.search
        ? {
            OR: [
              { orderNumber: { contains: filters.search, mode: "insensitive" } },
              { customerFirstName: { contains: filters.search, mode: "insensitive" } },
              { customerLastName: { contains: filters.search, mode: "insensitive" } },
              { customerEmail: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const direction = filters.sortDirection;
    const orderBy: Prisma.SaleOrderByWithRelationInput[] =
      filters.sortBy === "customer"
        ? [
            { customerLastName: direction },
            { customerFirstName: direction },
            { orderNumber: "asc" },
          ]
        : filters.sortBy === "payment"
          ? [{ paymentStatus: direction }, { orderNumber: "asc" }]
          : filters.sortBy === "orderNumber"
            ? [{ orderNumber: direction }, { id: "asc" }]
            : filters.sortBy === "status"
              ? [{ status: direction }, { orderNumber: "asc" }]
              : filters.sortBy === "total"
                ? [{ total: direction }, { orderNumber: "asc" }]
                : [{ createdAt: direction }, { orderNumber: "asc" }];
    const [total, items] = await Promise.all([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        orderBy,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        include: {
          items: { select: { id: true, productName: true, quantity: true, subtotal: true } },
        },
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
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: saleInclude,
    });
    if (!sale) {
      throw new NotFoundException("No se encontró la orden.");
    }
    return sale;
  }

  async create(input: SaleInput, actor: SaleActor, idempotencyKey: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const replay = await tx.sale.findUnique({
          where: { idempotencyKey },
          include: saleInclude,
        });
        if (replay) {
          return replay;
        }
        if (!input.customerId) {
          throw new BadRequestException("Debes seleccionar un cliente para la nueva venta.");
        }
        const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
        if (!customer) {
          throw new NotFoundException("No se encontró el cliente seleccionado.");
        }
        const products = await this.lockProducts(tx, input.items.map((item) => item.productId));
        if (products.length !== input.items.length) {
          throw new NotFoundException("Uno o más productos ya no existen.");
        }
        const byId = new Map(products.map((product) => [product.id, product]));
        const resolvedItems = input.items.map((item) => {
          const product = byId.get(item.productId);
          if (!product || !product.isActive) {
            throw new BadRequestException(
              "Solo se pueden agregar productos activos a una nueva venta.",
            );
          }
          return {
            product,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(product.price),
          };
        });
        const paymentStatus = input.paymentStatus;
        const deductStock = paymentStatus === "PAID";
        if (deductStock) {
          await this.applyStockDelta(
            tx,
            new Map(resolvedItems.map((item) => [item.product.id, item.quantity])),
          );
        }
        const sequence = await tx.$queryRaw<{ value: bigint }[]>`
          SELECT nextval('"sale_order_number_seq"') AS value
        `;
        const orderNumber = `ORD-${String(sequence[0].value).padStart(6, "0")}`;
        const total = moneyTotal(resolvedItems);
        const sale = await tx.sale.create({
          data: {
            orderNumber,
            idempotencyKey,
            customerId: customer.id,
            customerIdSnapshot: customer.id,
            customerFirstName: input.customerName ?? fullCustomerName(customer),
            customerLastName: null,
            customerEmail: input.customerEmail ?? customer.email,
            customerPhone: input.customerPhone ?? customer.phone,
            shippingAddress: input.shippingAddress,
            shippingCity: input.shippingCity,
            shippingPostalCode: input.shippingPostalCode,
            carrier: input.carrier ?? null,
            trackingNumber: input.trackingNumber ?? null,
            operationalNotes: input.operationalNotes ?? null,
            paymentMethod: input.paymentMethod,
            paymentStatus,
            status: deductStock ? "PREPARING" : "CANCELLED",
            stockDeducted: deductStock,
            total,
            items: {
              create: resolvedItems.map(({ product, quantity, unitPrice }) => ({
                productId: product.id,
                productIdSnapshot: product.id,
                productName: product.name,
                productDescription: product.description,
                brandName: product.brand.name,
                categoryName: product.category.name,
                subcategoryName: product.subcategory?.name ?? null,
                quantity,
                unitPrice,
                subtotal: unitPrice.mul(quantity).toDecimalPlaces(2),
              })),
            },
          },
          include: saleInclude,
        });
        await this.addHistory(tx, sale.id, actor, "CREATED", {
          orderNumber,
          status: sale.status,
          paymentStatus,
          stockDeducted: deductStock,
          total: total.toFixed(2),
          customer: {
            name: sale.customerFirstName,
            email: sale.customerEmail,
            phone: sale.customerPhone,
          },
          shipping: {
            address: sale.shippingAddress,
            city: sale.shippingCity,
            postalCode: sale.shippingPostalCode,
            carrier: sale.carrier,
            trackingNumber: sale.trackingNumber,
            notes: sale.operationalNotes,
          },
          items: sale.items.map((item) => ({
            productId: item.productIdSnapshot,
            name: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toFixed(2),
            subtotal: item.subtotal.toFixed(2),
          })),
        });
        return sale;
      });
    } catch (error) {
      if (prismaErrorCode(error) === "P2002") {
        const replay = await this.prisma.sale.findUnique({
          where: { idempotencyKey },
          include: saleInclude,
        });
        if (replay) {
          return replay;
        }
        throw new ConflictException("No se pudo asignar un identificador único a la orden.");
      }
      if (prismaErrorCode(error) === "P2034") {
        throw new ConflictException("La orden cambió en paralelo. Vuelve a intentarlo.");
      }
      throw error;
    }
  }

  async update(id: string, input: SaleUpdateInput, actor: SaleActor) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockSale(tx, id);
      const current = await tx.sale.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!current) {
        throw new NotFoundException("No se encontró la orden.");
      }
      if (current.status === "SHIPPED") {
        throw new ConflictException("Una orden enviada solo admite cambios operativos.");
      }
      if (current.status === "CANCELLED") {
        throw new ConflictException("Para editar una orden cancelada, debes reactivarla.");
      }

      const customer = input.customerId
        ? await tx.customer.findUnique({ where: { id: input.customerId } })
        : null;
      if (input.customerId && !customer) {
        throw new NotFoundException("No se encontró el cliente seleccionado.");
      }

      const oldQuantities = current.stockDeducted
        ? this.quantityMap(current.items.filter((item) => item.productId))
        : new Map<string, number>();
      const failPayment = input.paymentStatus === "FAILED";
      const nextItems = await this.resolveEditedItems(tx, input.items, current.items);
      const nextQuantities = new Map(
        nextItems.map((item) => [item.product.id, item.quantity]),
      );
      const delta = failPayment
        ? new Map([...oldQuantities].map(([productId, quantity]) => [productId, -quantity]))
        : this.difference(nextQuantities, oldQuantities);
      await this.lockProducts(tx, [...delta.keys()]);
      await this.applyStockDelta(tx, delta);
      const total = moneyTotal(nextItems);
      const snapshotName =
        input.customerName ??
        (customer && customer.id !== current.customerId
          ? fullCustomerName(customer)
          : [current.customerFirstName, current.customerLastName].filter(Boolean).join(" ").trim());
      const updated = await tx.sale.update({
        where: { id },
        data: {
          customerId: customer?.id ?? null,
          customerIdSnapshot: customer?.id ?? current.customerIdSnapshot,
          customerFirstName: snapshotName || current.customerFirstName,
          customerLastName: null,
          customerEmail: input.customerEmail ?? current.customerEmail,
          customerPhone: input.customerPhone ?? current.customerPhone,
          shippingAddress: input.shippingAddress,
          shippingCity: input.shippingCity,
          shippingPostalCode: input.shippingPostalCode,
          carrier: input.carrier ?? null,
          trackingNumber: input.trackingNumber ?? null,
          operationalNotes: input.operationalNotes ?? null,
          paymentMethod: input.paymentMethod,
          paymentStatus: input.paymentStatus,
          status: failPayment ? "CANCELLED" : "PREPARING",
          stockDeducted: !failPayment,
          total,
          items: {
            deleteMany: {},
            create: nextItems.map(({ product, quantity, unitPrice }) => ({
              productId: product.id,
              productIdSnapshot: product.id,
              productName: product.name,
              productDescription: product.description,
              brandName: product.brand.name,
              categoryName: product.category.name,
              subcategoryName: product.subcategory?.name ?? null,
              quantity,
              unitPrice,
              subtotal: unitPrice.mul(quantity).toDecimalPlaces(2),
            })),
          },
        },
        include: saleInclude,
      });
      await this.addHistory(tx, id, actor, failPayment ? "PAYMENT_FAILED_CANCELLED" : "UPDATED", {
        previousStatus: current.status,
        status: updated.status,
        previousPaymentStatus: current.paymentStatus,
        paymentStatus: updated.paymentStatus,
        previousPaymentMethod: current.paymentMethod,
        paymentMethod: updated.paymentMethod,
        previousCustomer: {
          name: current.customerFirstName,
          email: current.customerEmail,
          phone: current.customerPhone,
        },
        customer: {
          name: updated.customerFirstName,
          email: updated.customerEmail,
          phone: updated.customerPhone,
        },
        previousShipping: {
          address: current.shippingAddress,
          city: current.shippingCity,
          postalCode: current.shippingPostalCode,
          carrier: current.carrier,
          trackingNumber: current.trackingNumber,
          notes: current.operationalNotes,
        },
        shipping: {
          address: updated.shippingAddress,
          city: updated.shippingCity,
          postalCode: updated.shippingPostalCode,
          carrier: updated.carrier,
          trackingNumber: updated.trackingNumber,
          notes: updated.operationalNotes,
        },
        previousTotal: current.total.toFixed(2),
        total: total.toFixed(2),
        previousItems: current.items.map((item) => ({
          productId: item.productIdSnapshot,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          subtotal: item.subtotal.toFixed(2),
        })),
        items: updated.items.map((item) => ({
          productId: item.productIdSnapshot,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          subtotal: item.subtotal.toFixed(2),
        })),
      }, input.operationalNotes ?? undefined);
      return updated;
    });
  }

  async reactivate(id: string, input: SaleUpdateInput, actor: SaleActor) {
    if (input.paymentStatus !== "PAID") {
      throw new BadRequestException("Solo se puede reactivar una orden con el pago Pagado.");
    }
    return this.prisma.$transaction(async (tx) => {
      await this.lockSale(tx, id);
      const current = await tx.sale.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!current) {
        throw new NotFoundException("No se encontró la orden.");
      }
      if (current.status !== "CANCELLED") {
        throw new ConflictException("Solo se pueden reactivar órdenes canceladas.");
      }
      const customer = input.customerId
        ? await tx.customer.findUnique({ where: { id: input.customerId } })
        : null;
      if (input.customerId && !customer) {
        throw new NotFoundException("No se encontró el cliente seleccionado.");
      }
      const nextItems = await this.resolveEditedItems(tx, input.items, current.items);
      await this.lockProducts(tx, nextItems.map((item) => item.product.id));
      await this.applyStockDelta(
        tx,
        new Map(nextItems.map((item) => [item.product.id, item.quantity])),
      );
      const total = moneyTotal(nextItems);
      const snapshotName =
        input.customerName ??
        (customer && customer.id !== current.customerId
          ? fullCustomerName(customer)
          : [current.customerFirstName, current.customerLastName].filter(Boolean).join(" ").trim());
      const sale = await tx.sale.update({
        where: { id },
        data: {
          customerId: customer?.id ?? null,
          customerIdSnapshot: customer?.id ?? current.customerIdSnapshot,
          customerFirstName: snapshotName || current.customerFirstName,
          customerLastName: null,
          customerEmail: input.customerEmail ?? current.customerEmail,
          customerPhone: input.customerPhone ?? current.customerPhone,
          shippingAddress: input.shippingAddress,
          shippingCity: input.shippingCity,
          shippingPostalCode: input.shippingPostalCode,
          carrier: input.carrier ?? null,
          trackingNumber: input.trackingNumber ?? null,
          operationalNotes: input.operationalNotes ?? null,
          paymentMethod: input.paymentMethod,
          paymentStatus: "PAID",
          status: "PREPARING",
          stockDeducted: true,
          total,
          items: {
            deleteMany: {},
            create: nextItems.map(({ product, quantity, unitPrice }) => ({
              productId: product.id,
              productIdSnapshot: product.id,
              productName: product.name,
              productDescription: product.description,
              brandName: product.brand.name,
              categoryName: product.category.name,
              subcategoryName: product.subcategory?.name ?? null,
              quantity,
              unitPrice,
              subtotal: unitPrice.mul(quantity).toDecimalPlaces(2),
            })),
          },
        },
        include: saleInclude,
      });
      await this.addHistory(tx, id, actor, "REACTIVATED", {
        previousStatus: current.status,
        status: sale.status,
        previousPaymentStatus: current.paymentStatus,
        paymentStatus: sale.paymentStatus,
        previousPaymentMethod: current.paymentMethod,
        paymentMethod: sale.paymentMethod,
        customer: {
          name: sale.customerFirstName,
          email: sale.customerEmail,
          phone: sale.customerPhone,
        },
        shipping: {
          address: sale.shippingAddress,
          city: sale.shippingCity,
          postalCode: sale.shippingPostalCode,
          carrier: sale.carrier,
          trackingNumber: sale.trackingNumber,
          notes: sale.operationalNotes,
        },
        total: total.toFixed(2),
        items: sale.items.map((item) => ({
          productId: item.productIdSnapshot,
          name: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          subtotal: item.subtotal.toFixed(2),
        })),
      }, input.operationalNotes ?? undefined);
      return sale;
    });
  }

  async cancel(id: string, actor: SaleActor, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockSale(tx, id);
      const sale = await tx.sale.findUnique({ where: { id }, include: { items: true } });
      if (!sale) {
        throw new NotFoundException("No se encontró la orden.");
      }
      if (sale.status === "SHIPPED") {
        throw new ConflictException("No se pueden cancelar órdenes enviadas.");
      }
      if (sale.status === "CANCELLED") {
        return sale;
      }
      if (sale.stockDeducted) {
        const returnQuantities = this.quantityMap(sale.items.filter((item) => item.productId));
        await this.lockProducts(tx, [...returnQuantities.keys()]);
        for (const [productId, quantity] of returnQuantities) {
          await tx.product.update({
            where: { id: productId },
            data: { stock: { increment: quantity } },
          });
        }
      }
      const updated = await tx.sale.update({
        where: { id },
        data: { status: "CANCELLED", stockDeducted: false },
        include: saleInclude,
      });
      await this.addHistory(tx, id, actor, "CANCELLED", {
        previousStatus: sale.status,
        status: updated.status,
        stockReturned: sale.stockDeducted,
      }, note);
      return updated;
    });
  }

  async updatePayment(
    id: string,
    paymentStatus: PaymentStatus,
    actor: SaleActor,
    note?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockSale(tx, id);
      const sale = await tx.sale.findUnique({ where: { id } });
      if (!sale) {
        throw new NotFoundException("No se encontró la orden.");
      }
      if (sale.status === "SHIPPED") {
        throw new ConflictException("No se puede cambiar el pago de una orden enviada.");
      }
      if (paymentStatus === sale.paymentStatus) {
        return sale;
      }
      if (sale.status === "PREPARING" && paymentStatus === "FAILED") {
        if (sale.stockDeducted) {
          const quantities = this.quantityMap(
            (await tx.saleItem.findMany({ where: { saleId: id } })).filter(
              (item) => item.productId,
            ),
          );
          await this.lockProducts(tx, [...quantities.keys()]);
          for (const [productId, quantity] of quantities) {
            await tx.product.update({
              where: { id: productId },
              data: { stock: { increment: quantity } },
            });
          }
        }
        const cancelled = await tx.sale.update({
          where: { id },
          data: {
            paymentStatus: "FAILED",
            status: "CANCELLED",
            stockDeducted: false,
          },
        });
        await this.addHistory(tx, id, actor, "PAYMENT_FAILED_CANCELLED", {
          previousStatus: sale.status,
          status: cancelled.status,
          previousPaymentStatus: sale.paymentStatus,
          paymentStatus: cancelled.paymentStatus,
          stockReturned: sale.stockDeducted,
        }, note);
        return cancelled;
      }
      const updated = await tx.sale.update({
        where: { id },
        data: { paymentStatus },
      });
      await this.addHistory(tx, id, actor, "PAYMENT_UPDATED", {
        previousPaymentStatus: sale.paymentStatus,
        paymentStatus,
      }, note);
      return updated;
    });
  }

  async complete(id: string, input: SaleOperationalInput, actor: SaleActor) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockSale(tx, id);
      const sale = await tx.sale.findUnique({ where: { id } });
      if (!sale) {
        throw new NotFoundException("No se encontró la orden.");
      }
      if (sale.status !== "PREPARING" || sale.paymentStatus !== "PAID" || !sale.stockDeducted) {
        throw new ConflictException("Solo se pueden enviar órdenes pagadas en preparación.");
      }
      const updated = await tx.sale.update({
        where: { id },
        data: {
          status: "SHIPPED",
          carrier: input.carrier === undefined ? sale.carrier : input.carrier,
          trackingNumber:
            input.trackingNumber === undefined ? sale.trackingNumber : input.trackingNumber,
          operationalNotes:
            input.operationalNotes === undefined ? sale.operationalNotes : input.operationalNotes,
        },
        include: saleInclude,
      });
      await this.addHistory(tx, id, actor, "SHIPPED", {
        previousStatus: sale.status,
        status: updated.status,
        carrier: updated.carrier,
        trackingNumber: updated.trackingNumber,
      }, input.note ?? undefined);
      return updated;
    });
  }

  async updateOperations(id: string, input: SaleOperationalInput, actor: SaleActor) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockSale(tx, id);
      const sale = await tx.sale.findUnique({ where: { id } });
      if (!sale) {
        throw new NotFoundException("No se encontró la orden.");
      }
      if (sale.status !== "SHIPPED") {
        throw new ConflictException(
          "La corrección de datos operativos está disponible únicamente para órdenes enviadas.",
        );
      }
      const updated = await tx.sale.update({
        where: { id },
        data: {
          carrier: input.carrier === undefined ? sale.carrier : input.carrier,
          trackingNumber:
            input.trackingNumber === undefined ? sale.trackingNumber : input.trackingNumber,
          operationalNotes:
            input.operationalNotes === undefined ? sale.operationalNotes : input.operationalNotes,
        },
      });
      await this.addHistory(tx, id, actor, "OPERATIONS_UPDATED", {
        previousCarrier: sale.carrier,
        carrier: updated.carrier,
        previousTrackingNumber: sale.trackingNumber,
        trackingNumber: updated.trackingNumber,
        previousOperationalNotes: sale.operationalNotes,
        operationalNotes: updated.operationalNotes,
      }, input.note ?? undefined);
      return updated;
    });
  }

  private async lockSale(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Sale" WHERE "id" = ${id} FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new NotFoundException("No se encontró la orden.");
    }
  }

  private async lockProducts(tx: Prisma.TransactionClient, ids: string[]) {
    const uniqueIds = [...new Set(ids)].sort();
    if (uniqueIds.length === 0) {
      return [];
    }
    const rows = await tx.$queryRaw<
      { id: string; isActive: boolean; price: Prisma.Decimal; name: string; description: string | null; stock: number; brandName: string; categoryName: string; subcategoryName: string | null }[]
    >`
      SELECT p."id", p."isActive", p."price", p."name", p."description", p."stock",
             b."name" AS "brandName", c."name" AS "categoryName", sc."name" AS "subcategoryName"
      FROM "Product" p
      JOIN "Brand" b ON b."id" = p."brandId"
      JOIN "Category" c ON c."id" = p."categoryId"
      LEFT JOIN "Category" sc ON sc."id" = p."subcategoryId"
      WHERE p."id" IN (${Prisma.join(uniqueIds)})
      ORDER BY p."id"
      FOR UPDATE OF p
    `;
    return rows.map((row) => ({
      id: row.id,
      isActive: row.isActive,
      price: row.price,
      name: row.name,
      description: row.description,
      stock: row.stock,
      brand: { name: row.brandName },
      category: { name: row.categoryName },
      subcategory: row.subcategoryName ? { name: row.subcategoryName } : null,
    }));
  }

  private async applyStockDelta(
    tx: Prisma.TransactionClient,
    delta: Map<string, number>,
  ) {
    for (const [productId, change] of [...delta.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (change > 0) {
        const result = await tx.product.updateMany({
          where: { id: productId, stock: { gte: change } },
          data: { stock: { decrement: change } },
        });
        if (result.count !== 1) {
          throw new ConflictException("No hay stock suficiente para uno o más productos.");
        }
      } else if (change < 0) {
        const result = await tx.product.updateMany({
          where: { id: productId },
          data: { stock: { increment: -change } },
        });
        if (result.count !== 1) {
          throw new ConflictException(
            "No se puede devolver el stock porque un producto de la orden ya no está disponible.",
          );
        }
      }
    }
  }

  private async resolveEditedItems(
    tx: Prisma.TransactionClient,
    input: SaleUpdateInput["items"],
    currentItems: {
      productId: string | null;
      productIdSnapshot: string | null;
      productName: string;
      productDescription: string | null;
      brandName: string | null;
      categoryName: string | null;
      subcategoryName: string | null;
      quantity: number;
      unitPrice: Prisma.Decimal;
    }[],
  ) {
    const existingByProduct = new Map(
      currentItems.filter((item) => item.productId).map((item) => [item.productId!, item]),
    );
    const productIds = input.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException("No repitas productos en una misma orden.");
    }
    const products = await this.lockProducts(tx, productIds);
    if (products.length !== productIds.length) {
      throw new ConflictException(
        "La orden incluye productos eliminados. Reemplázalos antes de reactivarla.",
      );
    }
    const byId = new Map(products.map((product) => [product.id, product]));
    return input.map((line) => {
      const product = byId.get(line.productId);
      if (!product) {
        throw new NotFoundException("No se encontró un producto de la orden.");
      }
      const previous = existingByProduct.get(line.productId);
      if (!previous && !product.isActive) {
        throw new BadRequestException(
          "Solo se pueden agregar productos activos a la orden.",
        );
      }
      const unitPrice = decimal(line.unitPrice);
      return {
        product: {
          id: product.id,
          name: previous?.productName ?? product.name,
          description: previous
            ? previous.productDescription
            : product.description,
          brand: { name: previous ? previous.brandName ?? "" : product.brand.name },
          category: {
            name: previous ? previous.categoryName ?? "" : product.category.name,
          },
          subcategory: previous
            ? previous.subcategoryName
              ? { name: previous.subcategoryName }
              : null
            : product.subcategory,
        },
        quantity: line.quantity,
        unitPrice,
      };
    });
  }

  private quantityMap(
    items: { productId: string | null; quantity: number }[],
  ): Map<string, number> {
    const quantities = new Map<string, number>();
    for (const item of items) {
      if (item.productId) {
        quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
      }
    }
    return quantities;
  }

  private difference(
    next: Map<string, number>,
    current: Map<string, number>,
  ): Map<string, number> {
    const result = new Map<string, number>();
    for (const id of new Set([...next.keys(), ...current.keys()])) {
      result.set(id, (next.get(id) ?? 0) - (current.get(id) ?? 0));
    }
    return result;
  }

  private async addHistory(
    tx: Prisma.TransactionClient,
    saleId: string,
    actor: SaleActor,
    event: string,
    changes: Record<string, unknown>,
    note?: string,
  ) {
    await tx.saleHistory.create({
      data: {
        saleId,
        actorUserId: actor.id,
        actorEmail: actor.email,
        event,
        changes: historyChanges(changes),
        note: note?.trim() || null,
      },
    });
  }
}
