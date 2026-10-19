import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { resolveProductImageDirectory } from "./products/image-storage.service";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix("api");
  app.useStaticAssets(resolveProductImageDirectory(), {
    prefix: "/uploads/products/",
  });
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 4000);
}

void bootstrap();
