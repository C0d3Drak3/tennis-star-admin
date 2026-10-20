import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { BrandsModule } from "./brands/brands.module";
import { CategoriesModule } from "./categories/categories.module";
import { CustomersModule } from "./customers/customers.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { ProductsModule } from "./products/products.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SalesModule } from "./sales/sales.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CategoriesModule,
    CustomersModule,
    DashboardModule,
    BrandsModule,
    ProductsModule,
    SalesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
