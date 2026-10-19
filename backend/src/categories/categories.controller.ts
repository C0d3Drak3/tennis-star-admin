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
import { CategoriesService } from "./categories.service";

const MAX_CATEGORY_NAME_LENGTH = 100;

interface CategoryInput {
  name?: string;
  parentId?: string | null;
  position?: number;
}

function validateCategoryBody(body: unknown, partial: boolean): CategoryInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestException("El nombre de la categoría es obligatorio.");
  }

  const candidate = body as Record<string, unknown>;
  if (
    Object.keys(candidate).some(
      (key) => !["name", "parentId", "position"].includes(key),
    )
  ) {
    throw new BadRequestException("Los datos de la categoría no son válidos.");
  }

  const input: CategoryInput = {};
  if ("name" in candidate) {
    if (
      typeof candidate.name !== "string" ||
      candidate.name.trim().length === 0 ||
      candidate.name.trim().length > MAX_CATEGORY_NAME_LENGTH
    ) {
      throw new BadRequestException(
        `El nombre debe tener entre 1 y ${MAX_CATEGORY_NAME_LENGTH} caracteres.`,
      );
    }
    input.name = candidate.name.trim();
  } else if (!partial) {
    throw new BadRequestException("El nombre de la categoría es obligatorio.");
  }

  if ("parentId" in candidate) {
    if (
      candidate.parentId !== null &&
      (typeof candidate.parentId !== "string" ||
        candidate.parentId.trim().length === 0)
    ) {
      throw new BadRequestException("La categoría padre no es válida.");
    }
    input.parentId =
      typeof candidate.parentId === "string"
        ? candidate.parentId.trim()
        : null;
  }

  if ("position" in candidate) {
    if (
      typeof candidate.position !== "number" ||
      !Number.isSafeInteger(candidate.position) ||
      candidate.position < 1
    ) {
      throw new BadRequestException(
        "La posición debe ser un número entero positivo.",
      );
    }
    input.position = candidate.position;
  }

  if (partial && Object.keys(input).length === 0) {
    throw new BadRequestException(
      "Debes indicar al menos un dato para actualizar.",
    );
  }
  return input;
}

@Controller("categories")
@UseGuards(AuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list() {
    return this.categoriesService.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.categoriesService.get(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.categoriesService.create(validateCategoryBody(body, false));
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.categoriesService.update(
      id,
      validateCategoryBody(body, true),
    );
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.categoriesService.remove(id);
  }
}
