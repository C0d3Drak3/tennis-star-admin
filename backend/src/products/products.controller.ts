import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthGuard } from "../auth/auth.guard";
import {
  isUploadedProductImage,
  type UploadedProductImage,
} from "./image-storage.service";
import { ProductsService } from "./products.service";
import type {
  CreateProductInput,
  ProductInput,
  ProductListFilters,
  ProductOptionInput,
  ProductSortColumn,
  SortDirection,
} from "./products.types";

const MAX_PRODUCT_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2_000;
const PRICE_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const MAX_PRODUCT_OPTIONS = 20;
const MAX_OPTION_VALUES = 50;
const MAX_OPTION_NAME_LENGTH = 100;
const MAX_OPTION_VALUE_LENGTH = 100;

function parseProductOptions(value: unknown): ProductOptionInput[] {
  let optionsValue = value;
  if (typeof optionsValue === "string") {
    try {
      optionsValue = JSON.parse(optionsValue);
    } catch {
      throw new BadRequestException("Las opciones del producto no son válidas.");
    }
  }
  if (!Array.isArray(optionsValue) || optionsValue.length > MAX_PRODUCT_OPTIONS) {
    throw new BadRequestException("Las opciones del producto no son válidas.");
  }

  return optionsValue.map((option: unknown) => {
    if (
      typeof option !== "object" ||
      option === null ||
      Array.isArray(option) ||
      !("name" in option) ||
      !("values" in option)
    ) {
      throw new BadRequestException("Cada opción debe tener nombre y valores.");
    }
    const { name, values } = option;
    if (
      typeof name !== "string" ||
      name.trim().length === 0 ||
      name.trim().length > MAX_OPTION_NAME_LENGTH ||
      !Array.isArray(values) ||
      values.length > MAX_OPTION_VALUES
    ) {
      throw new BadRequestException("El nombre o los valores de una opción no son válidos.");
    }
    const normalizedValues = values.map((value: unknown) => {
      if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.trim().length > MAX_OPTION_VALUE_LENGTH
      ) {
        throw new BadRequestException("Los valores de opción no pueden estar vacíos y deben tener hasta 100 caracteres.");
      }
      return value.trim();
    });
    const uniqueValues = new Set(
      normalizedValues.map((value) => value.replace(/\s+/g, " ").toLowerCase()),
    );
    if (uniqueValues.size !== normalizedValues.length) {
      throw new BadRequestException("No repitas valores dentro de una misma opción.");
    }
    return { name: name.trim(), values: normalizedValues };
  });
}

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
    "brandId",
    "categoryId",
    "subcategoryId",
    "stock",
    "isActive",
    "options",
  ]);
  if (Object.keys(candidate).some((key) => !allowedFields.has(key))) {
    throw new BadRequestException("Los datos del producto no son válidos.");
  }
  if (
    !partial &&
    ["name", "price", "brandId", "categoryId", "stock"].some(
      (key) => !(key in candidate),
    )
  ) {
    throw new BadRequestException(
      "Nombre, precio, marca, categoría principal y stock son obligatorios.",
    );
  }
  if (partial && Object.keys(candidate).length === 0) {
    throw new BadRequestException(
      "Debes indicar al menos un dato para actualizar.",
    );
  }

  const input: ProductInput = {};
  if ("options" in candidate) {
    input.options = parseProductOptions(candidate.options);
  }
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
        "El precio debe ser positivo y tener hasta dos decimales.",
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
  for (const key of ["brandId", "categoryId"] as const) {
    if (key in candidate) {
      if (
        typeof candidate[key] !== "string" ||
        candidate[key].trim().length === 0
      ) {
        throw new BadRequestException(
          key === "brandId"
            ? "Debes seleccionar una marca válida."
            : "Debes seleccionar una categoría principal válida.",
        );
      }
      input[key] = candidate[key].trim();
    }
  }
  if ("subcategoryId" in candidate) {
    if (
      candidate.subcategoryId !== null &&
      (typeof candidate.subcategoryId !== "string" ||
        (candidate.subcategoryId.trim().length === 0 &&
          candidate.subcategoryId !== ""))
    ) {
      throw new BadRequestException("La subcategoría no es válida.");
    }
    input.subcategoryId =
      typeof candidate.subcategoryId === "string" &&
      candidate.subcategoryId.trim().length > 0
        ? candidate.subcategoryId.trim()
        : null;
  }
  if ("stock" in candidate) {
    const stock =
      typeof candidate.stock === "number"
        ? candidate.stock
        : typeof candidate.stock === "string" &&
            /^\d+$/.test(candidate.stock.trim())
          ? Number(candidate.stock)
          : Number.NaN;
    if (
      !Number.isSafeInteger(stock) ||
      stock < 0 ||
      stock > 2_147_483_647
    ) {
      throw new BadRequestException(
        "El stock debe ser un número entero no negativo.",
      );
    }
    input.stock = stock;
  }
  if ("isActive" in candidate) {
    const isActive =
      candidate.isActive === "true"
        ? true
        : candidate.isActive === "false"
          ? false
          : candidate.isActive;
    if (typeof isActive !== "boolean") {
      throw new BadRequestException("El estado del producto no es válido.");
    }
    input.isActive = isActive;
  }

  if (!partial) {
    if (
      typeof input.name !== "string" ||
      typeof input.price !== "string" ||
      typeof input.brandId !== "string" ||
      typeof input.categoryId !== "string" ||
      typeof input.stock !== "number"
    ) {
      throw new BadRequestException(
        "Nombre, precio, marca, categoría principal y stock son obligatorios.",
      );
    }
    return {
      ...input,
      name: input.name,
      price: input.price,
      brandId: input.brandId,
      categoryId: input.categoryId,
      stock: input.stock,
    };
  }
  return input;
}

function parseListFilters(query: Record<string, unknown>): ProductListFilters {
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? 10 : Number(query.pageSize);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    throw new BadRequestException("La página o el tamaño de página no son válidos.");
  }

  let isActive: boolean | undefined;
  if (query.isActive !== undefined && query.isActive !== "") {
    if (query.isActive === "true") {
      isActive = true;
    } else if (query.isActive === "false") {
      isActive = false;
    } else {
      throw new BadRequestException("El filtro de estado no es válido.");
    }
  }

  const sortColumns: ProductSortColumn[] = [
    "category",
    "brand",
    "stock",
    "price",
    "status",
    "name",
  ];
  const isSortColumn = (value: unknown): value is ProductSortColumn =>
    typeof value === "string" && sortColumns.some((column) => column === value);
  const sortBy: ProductSortColumn | null =
    query.sortBy === undefined
      ? "name"
      : isSortColumn(query.sortBy)
        ? query.sortBy
        : null;
  const isSortDirection = (value: unknown): value is SortDirection =>
    value === "asc" || value === "desc";
  const sortDirection =
    query.sortDirection === undefined
      ? "asc"
      : isSortDirection(query.sortDirection)
        ? query.sortDirection
        : null;
  if (sortBy === null || sortDirection === null) {
    throw new BadRequestException("El ordenamiento solicitado no es válido.");
  }

  return {
    search: typeof query.search === "string" ? query.search.trim() : undefined,
    categoryId:
      typeof query.categoryId === "string" ? query.categoryId : undefined,
    brandId: typeof query.brandId === "string" ? query.brandId : undefined,
    isActive,
    page,
    pageSize,
    sortBy,
    sortDirection,
  };
}

function imageFileFilter(
  _request: unknown,
  file: { mimetype: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!SUPPORTED_IMAGE_TYPES.has(file.mimetype)) {
    callback(
      new BadRequestException(
        "Formato de imagen no admitido. Usa JPEG, PNG, GIF o WebP.",
      ),
      false,
    );
    return;
  }
  callback(null, true);
}

const productImageInterceptor = FileInterceptor("image", {
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: imageFileFilter,
});

@Controller("products")
@UseGuards(AuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.productsService.list(parseListFilters(query));
  }

  @Post()
  @UseInterceptors(productImageInterceptor)
  create(@Body() body: unknown, @UploadedFile() file: unknown) {
    if (!isUploadedProductImage(file)) {
      throw new BadRequestException("Debes cargar una imagen para el producto.");
    }
    return this.productsService.create(
      validateProductBody(body, false),
      file as UploadedProductImage,
    );
  }

  @Patch(":id")
  @UseInterceptors(productImageInterceptor)
  update(
    @Param("id") id: string,
    @Body() body: unknown,
    @UploadedFile() file: unknown,
  ) {
    return this.productsService.update(
      id,
      validateProductBody(body, true),
      isUploadedProductImage(file) ? file : undefined,
    );
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.productsService.remove(id);
  }
}
