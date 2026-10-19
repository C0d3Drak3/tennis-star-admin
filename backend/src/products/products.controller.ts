import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { ProductsService } from "./products.service";
import type {
  CreateProductInput,
  ProductInput,
} from "./products.types";

const MAX_PRODUCT_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2_000;
const PRICE_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

function validateProductBody(body: unknown, partial: false): CreateProductInput;
function validateProductBody(body: unknown, partial: true): ProductInput;
function validateProductBody(
  body: unknown,
  partial: boolean,
): ProductInput | CreateProductInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestException("Los datos del producto no son válidos.");
  }

  const candidate = body as Record<string, unknown>;
  const allowedFields = new Set([
    "name",
    "price",
    "description",
    "categoryId",
    "isActive",
  ]);
  if (Object.keys(candidate).some((key) => !allowedFields.has(key))) {
    throw new BadRequestException("Los datos del producto no son válidos.");
  }
  if (!partial && (!("name" in candidate) || !("price" in candidate) || !("categoryId" in candidate))) {
    throw new BadRequestException(
      "El nombre, precio y categoría son obligatorios.",
    );
  }
  if (partial && Object.keys(candidate).length === 0) {
    throw new BadRequestException("Debes indicar al menos un dato para actualizar.");
  }

  const input: ProductInput = {};
  if ("name" in candidate) {
    if (
      typeof candidate.name !== "string" ||
      candidate.name.trim().length === 0 ||
      candidate.name.trim().length > MAX_PRODUCT_NAME_LENGTH
    ) {
      throw new BadRequestException(
        `El nombre debe tener entre 1 y ${MAX_PRODUCT_NAME_LENGTH} caracteres.`,
      );
    }
    input.name = candidate.name.trim();
  }
  if ("price" in candidate) {
    const price =
      typeof candidate.price === "string" ? candidate.price.trim() : "";
    const [whole, fraction = ""] = price.split(".");
    if (
      !PRICE_PATTERN.test(price) ||
      BigInt(whole || "0") * 100n + BigInt(fraction.padEnd(2, "0")) <= 0n
    ) {
      throw new BadRequestException(
        "El precio debe ser un número positivo con hasta dos decimales.",
      );
    }
    input.price = price;
  }
  if ("description" in candidate) {
    if (
      candidate.description !== null &&
      (typeof candidate.description !== "string" ||
        candidate.description.length > MAX_DESCRIPTION_LENGTH)
    ) {
      throw new BadRequestException(
        `La descripción debe tener hasta ${MAX_DESCRIPTION_LENGTH} caracteres.`,
      );
    }
    input.description =
      typeof candidate.description === "string"
        ? candidate.description.trim() || null
        : null;
  }
  if ("categoryId" in candidate) {
    if (
      typeof candidate.categoryId !== "string" ||
      candidate.categoryId.trim().length === 0
    ) {
      throw new BadRequestException("Debes seleccionar una categoría válida.");
    }
    input.categoryId = candidate.categoryId.trim();
  }
  if ("isActive" in candidate) {
    if (typeof candidate.isActive !== "boolean") {
      throw new BadRequestException("El estado del producto no es válido.");
    }
    input.isActive = candidate.isActive;
  }

  if (!partial) {
    if (
      typeof input.name !== "string" ||
      typeof input.price !== "string" ||
      typeof input.categoryId !== "string"
    ) {
      throw new BadRequestException(
        "El nombre, precio y categoría son obligatorios.",
      );
    }
    return {
      ...input,
      name: input.name,
      price: input.price,
      categoryId: input.categoryId,
    };
  }

  return input;
}

@Controller("products")
@UseGuards(AuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list() {
    return this.productsService.list();
  }

  @Post()
  create(@Body() body: unknown) {
    return this.productsService.create(validateProductBody(body, false));
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.productsService.update(id, validateProductBody(body, true));
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.productsService.remove(id);
  }
}
