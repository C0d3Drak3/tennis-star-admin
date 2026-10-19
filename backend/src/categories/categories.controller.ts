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
import { CategoriesService } from "./categories.service";

const MAX_CATEGORY_NAME_LENGTH = 100;

function validateCategoryBody(body: unknown): { name: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestException("El nombre de la categoría es obligatorio.");
  }

  const name = (body as Record<string, unknown>).name;
  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    name.trim().length > MAX_CATEGORY_NAME_LENGTH
  ) {
    throw new BadRequestException(
      `El nombre debe tener entre 1 y ${MAX_CATEGORY_NAME_LENGTH} caracteres.`,
    );
  }

  return { name: name.trim() };
}

@Controller("categories")
@UseGuards(AuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list() {
    return this.categoriesService.list();
  }

  @Post()
  create(@Body() body: unknown) {
    const { name } = validateCategoryBody(body);
    return this.categoriesService.create(name);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    const { name } = validateCategoryBody(body);
    return this.categoriesService.update(id, name);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.categoriesService.remove(id);
  }
}
