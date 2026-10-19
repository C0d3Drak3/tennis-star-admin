import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ImageStorageService } from "./image-storage.service";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [AuthModule],
  controllers: [ProductsController],
  providers: [ProductsService, ImageStorageService],
  exports: [ImageStorageService],
})
export class ProductsModule {}
