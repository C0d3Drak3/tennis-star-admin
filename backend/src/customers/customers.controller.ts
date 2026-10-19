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
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CustomersService } from "./customers.service";
import type {
  CreateCustomerInput,
  CustomerInput,
  CustomerListFilters,
  CustomerSortColumn,
  SortDirection,
} from "./customers.types";

const FIELD_LIMITS = {
  firstName: 100,
  lastName: 100,
  email: 254,
  phone: 40,
  shippingAddress: 200,
  city: 100,
  postalCode: 20,
} as const;

const CUSTOMER_FIELDS = Object.keys(FIELD_LIMITS) as Array<
  keyof typeof FIELD_LIMITS
>;

function validateCustomerBody(
  body: unknown,
  partial: false,
): CreateCustomerInput;
function validateCustomerBody(body: unknown, partial: true): CustomerInput;
function validateCustomerBody(
  body: unknown,
  partial: boolean,
): CustomerInput | CreateCustomerInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestException("Los datos del cliente no son válidos.");
  }

  const candidate = body as Record<string, unknown>;
  if (
    Object.keys(candidate).some(
      (key) => !CUSTOMER_FIELDS.includes(key as keyof typeof FIELD_LIMITS),
    )
  ) {
    throw new BadRequestException("Los datos del cliente no son válidos.");
  }
  if (
    !partial &&
    CUSTOMER_FIELDS.some((field) => !(field in candidate))
  ) {
    throw new BadRequestException("Todos los datos del cliente son obligatorios.");
  }
  if (partial && Object.keys(candidate).length === 0) {
    throw new BadRequestException(
      "Debes indicar al menos un dato para actualizar.",
    );
  }

  const input: CustomerInput = {};
  for (const field of CUSTOMER_FIELDS) {
    if (!(field in candidate)) {
      continue;
    }
    if (typeof candidate[field] !== "string") {
      throw new BadRequestException(
        `El campo ${field} debe ser texto y no puede estar vacío.`,
      );
    }
    const value = candidate[field].trim();
    if (!value || value.length > FIELD_LIMITS[field]) {
      throw new BadRequestException(
        `El campo ${field} debe tener entre 1 y ${FIELD_LIMITS[field]} caracteres.`,
      );
    }
    if (field === "email") {
      const normalizedEmail = value.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new BadRequestException("Ingresa un email válido.");
      }
      input.email = normalizedEmail;
    } else {
      input[field] = value;
    }
  }

  if (!partial) {
    return input as CreateCustomerInput;
  }
  return input;
}

function parseListFilters(query: Record<string, unknown>): CustomerListFilters {
  const allowedQueryKeys = new Set([
    "search",
    "page",
    "pageSize",
    "sortBy",
    "sortDirection",
  ]);
  if (Object.keys(query).some((key) => !allowedQueryKeys.has(key))) {
    throw new BadRequestException("Los filtros de clientes no son válidos.");
  }

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

  const sortColumns: CustomerSortColumn[] = [
    "firstName",
    "lastName",
    "email",
    "city",
    "createdAt",
  ];
  const isSortColumn = (value: unknown): value is CustomerSortColumn =>
    typeof value === "string" &&
    sortColumns.some((column) => column === value);
  const sortBy: CustomerSortColumn | null =
    query.sortBy === undefined
      ? "lastName"
      : isSortColumn(query.sortBy)
        ? query.sortBy
        : null;
  const sortDirection: SortDirection | null =
    query.sortDirection === undefined
      ? "asc"
      : query.sortDirection === "asc" || query.sortDirection === "desc"
        ? query.sortDirection
        : null;
  if (sortBy === null || sortDirection === null) {
    throw new BadRequestException("El ordenamiento solicitado no es válido.");
  }

  const search =
    query.search === undefined
      ? undefined
      : typeof query.search === "string"
        ? query.search.trim()
        : null;
  if (search === null || (search && search.length > 254)) {
    throw new BadRequestException("El término de búsqueda no es válido.");
  }

  return {
    search,
    page,
    pageSize,
    sortBy,
    sortDirection,
  };
}

@Controller("customers")
@UseGuards(AuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.customersService.list(parseListFilters(query));
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.customersService.get(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.customersService.create(validateCustomerBody(body, false));
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.customersService.update(
      id,
      validateCustomerBody(body, true),
    );
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.customersService.remove(id);
  }
}
