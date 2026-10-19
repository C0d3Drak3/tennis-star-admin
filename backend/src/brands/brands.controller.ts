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
import { BrandsService } from "./brands.service";

interface BrandBody {
  name: string;
}

function validateBrandBody(body: unknown, partial = false): Partial<BrandBody> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestException("El nombre de la marca es obligatorio.");
  }
  const candidate = body as Record<string, unknown>;
  if (
    Object.keys(candidate).some((key) => key !== "name") ||
    (partial && Object.keys(candidate).length === 0)
  ) {
    throw new BadRequestException("Los datos de la marca no son válidos.");
  }
  if (!("name" in candidate) && partial) {
    throw new BadRequestException("Debes indicar el nombre de la marca.");
  }
  const name = candidate.name;
  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    name.trim().length > 100
  ) {
    throw new BadRequestException(
      "El nombre de la marca debe tener entre 1 y 100 caracteres.",
    );
  }
  return { name: name.trim() };
}

@Controller("brands")
@UseGuards(AuthGuard)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  list() {
    return this.brandsService.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.brandsService.get(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.brandsService.create(validateBrandBody(body) as BrandBody);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.brandsService.update(
      id,
      validateBrandBody(body, true) as BrandBody,
    );
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.brandsService.remove(id);
  }
}
