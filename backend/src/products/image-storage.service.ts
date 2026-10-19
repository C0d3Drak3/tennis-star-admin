import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { BadRequestException, Injectable } from "@nestjs/common";
import { resolve } from "node:path";
import { PrismaService } from "../prisma/prisma.service";

export interface UploadedProductImage {
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const IMAGE_TYPES: Record<string, { extension: string; signature: (buffer: Buffer) => boolean }> = {
  "image/jpeg": {
    extension: "jpg",
    signature: (buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  "image/png": {
    extension: "png",
    signature: (buffer) =>
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  "image/gif": {
    extension: "gif",
    signature: (buffer) =>
      buffer.length >= 6 &&
      ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii")),
  },
  "image/webp": {
    extension: "webp",
    signature: (buffer) =>
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP",
  },
};

export function resolveProductImageDirectory(): string {
  return resolve(process.env.PRODUCT_IMAGE_DIR ?? "uploads/products");
}

export function isUploadedProductImage(
  value: unknown,
): value is UploadedProductImage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const file = value as Record<string, unknown>;
  return (
    typeof file.mimetype === "string" &&
    typeof file.size === "number" &&
    Buffer.isBuffer(file.buffer)
  );
}

@Injectable()
export class ImageStorageService {
  readonly directory = resolveProductImageDirectory();

  constructor(private readonly prisma: PrismaService) {}

  async save(image: UploadedProductImage): Promise<string> {
    const type = IMAGE_TYPES[image.mimetype];
    if (!type || !type.signature(image.buffer)) {
      throw new BadRequestException(
        "El archivo no contiene una imagen válida en un formato admitido.",
      );
    }
    if (image.size > 5 * 1024 * 1024) {
      throw new BadRequestException("La imagen no puede superar los 5 MB.");
    }

    await mkdir(this.directory, { recursive: true });
    const filename = `${randomUUID()}.${type.extension}`;
    await writeFile(resolve(this.directory, filename), image.buffer, {
      flag: "wx",
    });
    return `/uploads/products/${filename}`;
  }

  async removeIfUnreferenced(imageUrl: string | null | undefined) {
    if (
      !imageUrl ||
      !/^\/uploads\/products\/[0-9a-f-]{36}\.(?:jpg|png|gif|webp)$/i.test(
        imageUrl,
      )
    ) {
      return;
    }

    const referenced = await this.prisma.product.count({
      where: { imageUrl },
    });
    if (referenced > 0) {
      return;
    }

    const filename = imageUrl.slice("/uploads/products/".length);
    try {
      await unlink(resolve(this.directory, filename));
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return;
      }
      throw error;
    }
  }
}
