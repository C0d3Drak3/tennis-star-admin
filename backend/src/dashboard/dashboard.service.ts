import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      inventoryCount,
      inventoryProducts,
      inventoryValue,
      recentOrders,
      topProducts,
      lowStockProducts,
    ] =
      await Promise.all([
        this.prisma.product.count({ where: { stock: { gt: 0 } } }),
        this.prisma.product.findMany({
          where: { stock: { gt: 0 } },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take: 8,
          select: { id: true, name: true, stock: true },
        }),
        this.prisma.$queryRaw<{ value: Prisma.Decimal }[]>`
          SELECT COALESCE(SUM("price" * "stock"), 0)::numeric(20, 2) AS value
          FROM "Product"
        `,
        this.prisma.sale.findMany({
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 5,
          select: {
            orderNumber: true,
            customerFirstName: true,
            customerLastName: true,
            status: true,
            paymentStatus: true,
            total: true,
            createdAt: true,
          },
        }),
        this.prisma.saleItem.groupBy({
          by: ["productName"],
          where: {
            sale: {
              status: { in: ["PREPARING", "SHIPPED"] },
              paymentStatus: "PAID",
            },
          },
          _sum: { quantity: true },
          orderBy: [{ _sum: { quantity: "desc" } }, { productName: "asc" }],
          take: 5,
        }),
        this.prisma.product.findMany({
          where: { stock: { lt: 10 } },
          orderBy: [{ stock: "asc" }, { name: "asc" }, { id: "asc" }],
          select: { id: true, name: true, stock: true },
        }),
      ]);

    return {
      inventory: {
        productCount: inventoryCount,
        value: inventoryValue[0]?.value.toFixed(2) ?? "0.00",
        products: inventoryProducts,
      },
      recentOrders: recentOrders.map((sale) => ({
        orderNumber: sale.orderNumber,
        customerName:
          [sale.customerFirstName, sale.customerLastName]
            .filter(Boolean)
            .join(" ")
            .trim() || "Cliente histórico",
        status: sale.status,
        paymentStatus: sale.paymentStatus,
        total: sale.total.toFixed(2),
        createdAt: sale.createdAt,
      })),
      topProducts: topProducts.map((product) => ({
        name: product.productName,
        quantity: product._sum.quantity ?? 0,
      })),
      lowStockProducts,
    };
  }
}
