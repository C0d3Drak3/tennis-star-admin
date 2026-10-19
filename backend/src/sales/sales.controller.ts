import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { OrderStatus, PaymentMethod, PaymentStatus } from "../generated/prisma/client";
import { SalesService } from "./sales.service";
import type {
  SaleInput,
  SaleListFilters,
  SaleOperationalInput,
  SaleUpdateInput,
} from "./sales.types";

const MAX_TEXT = {
  shippingAddress: 200,
  shippingCity: 100,
  shippingPostalCode: 20,
  customerName: 200,
  customerEmail: 254,
  customerPhone: 40,
  carrier: 100,
  trackingNumber: 100,
  operationalNotes: 2_000,
  note: 2_000,
} as const;
const PRICE_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

function record(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException(message);
  }
  return value as Record<string, unknown>;
}

function optionalText(
  body: Record<string, unknown>,
  field: keyof typeof MAX_TEXT,
): string | null | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || value.trim().length > MAX_TEXT[field]) {
    throw new BadRequestException(`El campo ${field} no es válido.`);
  }
  return value.trim() || null;
}

function requiredText(
  body: Record<string, unknown>,
  field: "customerId" | "shippingAddress" | "shippingCity" | "shippingPostalCode",
): string {
  const value = body[field];
  const maxLength = field === "customerId" ? 30 : MAX_TEXT[field];
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > maxLength
  ) {
    throw new BadRequestException(`El campo ${field} es obligatorio y no es válido.`);
  }
  return value.trim();
}

function parseSaleInput(bodyValue: unknown, update = false): SaleInput | SaleUpdateInput {
  const body = record(bodyValue, "Los datos de la orden no son válidos.");
  const allowed = new Set([
    "customerId",
    "customerName",
    "customerEmail",
    "customerPhone",
    "paymentMethod",
    "paymentStatus",
    "shippingAddress",
    "shippingCity",
    "shippingPostalCode",
    "carrier",
    "trackingNumber",
    "operationalNotes",
    "items",
  ]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new BadRequestException("Los datos de la orden contienen campos no permitidos.");
  }
  if (
    !Array.isArray(body.items) ||
    body.items.length === 0 ||
    body.items.length > 100
  ) {
    throw new BadRequestException("La orden debe incluir entre 1 y 100 productos.");
  }
  if (body.paymentMethod !== PaymentMethod.CASH && body.paymentMethod !== PaymentMethod.CARD) {
    throw new BadRequestException("El método de pago no es válido.");
  }
  if (body.paymentStatus !== PaymentStatus.PAID && body.paymentStatus !== PaymentStatus.FAILED) {
    throw new BadRequestException("El estado del pago no es válido.");
  }
  let customerId: string | null;
  if (body.customerId === null || body.customerId === "") {
    if (!update) {
      throw new BadRequestException("Selecciona un cliente válido.");
    }
    customerId = null;
  } else if (typeof body.customerId === "string" && body.customerId.trim().length <= 30) {
    customerId = body.customerId.trim();
  } else {
    throw new BadRequestException("Selecciona un cliente válido.");
  }

  const customerName = (): string | undefined => {
    const value = body.customerName;
    if (value === undefined) return undefined;
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized || normalized.length > MAX_TEXT.customerName) {
      throw new BadRequestException("El nombre histórico del cliente no es válido.");
    }
    return normalized;
  };
  const customerSnapshot = (field: "customerEmail" | "customerPhone"): string | undefined => {
    const value = body[field];
    if (value === undefined) return undefined;
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized || normalized.length > MAX_TEXT[field]) {
      throw new BadRequestException(`El campo ${field} no es válido.`);
    }
    if (field === "customerEmail" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new BadRequestException("El email histórico de la orden no es válido.");
    }
    return field === "customerEmail" ? normalized.toLowerCase() : normalized;
  };

  const items = body.items.map((raw, index) => {
    const item = record(raw, `La línea ${index + 1} no es válida.`);
    const expectedKeys = update
      ? ["productId", "quantity", "unitPrice"]
      : ["productId", "quantity"];
    if (Object.keys(item).some((key) => !expectedKeys.includes(key))) {
      throw new BadRequestException(`La línea ${index + 1} contiene campos no permitidos.`);
    }
    if (
      typeof item.productId !== "string" ||
      !item.productId.trim() ||
      !Number.isSafeInteger(item.quantity) ||
      (item.quantity as number) < 1 ||
      (item.quantity as number) > 2_147_483_647
    ) {
      throw new BadRequestException(`La línea ${index + 1} tiene producto o cantidad inválidos.`);
    }
    let unitPrice: string | undefined;
    if (update) {
      unitPrice = typeof item.unitPrice === "string" ? item.unitPrice.trim() : "";
      if (
        !PRICE_PATTERN.test(unitPrice) ||
        BigInt(unitPrice.split(".")[0] || "0") * 100n +
          BigInt((unitPrice.split(".")[1] ?? "").padEnd(2, "0")) >
          999_999_999_999n
      ) {
        throw new BadRequestException(`El precio de la línea ${index + 1} no es válido.`);
      }
    }
    return {
      productId: item.productId.trim(),
      quantity: item.quantity as number,
      ...(unitPrice === undefined ? {} : { unitPrice }),
    };
  });
  if (new Set(items.map((item) => item.productId)).size !== items.length) {
    throw new BadRequestException("No repitas productos en una misma orden.");
  }

  const input: SaleInput = {
    customerId,
    customerName: customerName(),
    customerEmail: customerSnapshot("customerEmail"),
    customerPhone: customerSnapshot("customerPhone"),
    paymentMethod: body.paymentMethod,
    paymentStatus: body.paymentStatus,
    shippingAddress: requiredText(body, "shippingAddress"),
    shippingCity: requiredText(body, "shippingCity"),
    shippingPostalCode: requiredText(body, "shippingPostalCode"),
    carrier: optionalText(body, "carrier"),
    trackingNumber: optionalText(body, "trackingNumber"),
    operationalNotes: optionalText(body, "operationalNotes"),
    items,
  };
  return input;
}

function parseOperationalInput(value: unknown): SaleOperationalInput {
  const body = record(value, "Los datos operativos no son válidos.");
  const allowed = new Set(["carrier", "trackingNumber", "operationalNotes", "note"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new BadRequestException("Los datos operativos contienen campos no permitidos.");
  }
  return {
    carrier: optionalText(body, "carrier"),
    trackingNumber: optionalText(body, "trackingNumber"),
    operationalNotes: optionalText(body, "operationalNotes"),
    note: optionalText(body, "note"),
  };
}

function parseListFilters(query: Record<string, unknown>): SaleListFilters {
  const allowed = new Set([
    "search",
    "status",
    "paymentStatus",
    "page",
    "pageSize",
    "sortBy",
    "sortDirection",
  ]);
  if (Object.keys(query).some((key) => !allowed.has(key))) {
    throw new BadRequestException("Los filtros de ventas no son válidos.");
  }
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? 10 : Number(query.pageSize);
  const sortColumns = ["customer", "orderNumber", "status", "total", "payment", "createdAt"] as const;
  const sortBy = query.sortBy === undefined ? "createdAt" : query.sortBy;
  const sortDirection = query.sortDirection === undefined ? "desc" : query.sortDirection;
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100 ||
    typeof sortBy !== "string" ||
    !sortColumns.includes(sortBy as (typeof sortColumns)[number]) ||
    (sortDirection !== "asc" && sortDirection !== "desc")
  ) {
    throw new BadRequestException("La página o el ordenamiento no son válidos.");
  }
  const status =
    query.status === undefined || query.status === ""
      ? undefined
      : Object.values(OrderStatus).find((value) => value === query.status);
  const paymentStatus =
    query.paymentStatus === undefined || query.paymentStatus === ""
      ? undefined
      : Object.values(PaymentStatus).find((value) => value === query.paymentStatus);
  if (
    (query.status !== undefined && query.status !== "" && !status) ||
    (query.paymentStatus !== undefined && query.paymentStatus !== "" && !paymentStatus)
  ) {
    throw new BadRequestException("El filtro de estado no es válido.");
  }
  const search =
    query.search === undefined
      ? undefined
      : typeof query.search === "string"
        ? query.search.trim()
        : null;
  if (search === null || (search && search.length > 254)) {
    throw new BadRequestException("La búsqueda no es válida.");
  }
  return {
    search,
    status,
    paymentStatus,
    page,
    pageSize,
    sortBy: sortBy as SaleListFilters["sortBy"],
    sortDirection,
  };
}

@Controller("sales")
@UseGuards(AuthGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.salesService.list(parseListFilters(query));
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.salesService.get(id);
  }

  @Post()
  create(
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    if (
      !idempotencyKey ||
      idempotencyKey.length > 100 ||
      !/^[\w-]{16,100}$/.test(idempotencyKey)
    ) {
      throw new BadRequestException("El identificador de solicitud no es válido.");
    }
    return this.salesService.create(
      parseSaleInput(body) as SaleInput,
      this.actor(request),
      idempotencyKey,
    );
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.salesService.update(
      id,
      parseSaleInput(body, true) as SaleUpdateInput,
      this.actor(request),
    );
  }

  @Post(":id/reactivate")
  reactivate(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.salesService.reactivate(
      id,
      parseSaleInput(body, true) as SaleUpdateInput,
      this.actor(request),
    );
  }

  @Post(":id/cancel")
  cancel(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const parsed = parseOperationalInput(body);
    return this.salesService.cancel(id, this.actor(request), parsed.note ?? undefined);
  }

  @Patch(":id/payment")
  updatePayment(
    @Param("id") id: string,
    @Body() bodyValue: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const body = record(bodyValue, "El estado del pago no es válido.");
    if (
      Object.keys(body).some((key) => !["paymentStatus", "note"].includes(key)) ||
      (body.paymentStatus !== PaymentStatus.PAID &&
        body.paymentStatus !== PaymentStatus.FAILED)
    ) {
      throw new BadRequestException("El estado del pago no es válido.");
    }
    const note = optionalText(body, "note");
    return this.salesService.updatePayment(
      id,
      body.paymentStatus,
      this.actor(request),
      note ?? undefined,
    );
  }

  @Post(":id/complete")
  complete(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.salesService.complete(
      id,
      parseOperationalInput(body),
      this.actor(request),
    );
  }

  @Patch(":id/operations")
  updateOperations(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.salesService.updateOperations(
      id,
      parseOperationalInput(body),
      this.actor(request),
    );
  }

  private actor(request: AuthenticatedRequest) {
    if (!request.authUser) {
      throw new BadRequestException("No se pudo identificar al usuario autenticado.");
    }
    return request.authUser;
  }
}
