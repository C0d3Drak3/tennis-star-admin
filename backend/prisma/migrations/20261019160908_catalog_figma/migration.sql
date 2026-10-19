/*
  Warnings:

  - Added the required column `brandId` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `imageUrl` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stock` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brandId" TEXT NOT NULL,
ADD COLUMN     "imageUrl" TEXT NOT NULL,
ADD COLUMN     "stock" INTEGER NOT NULL,
ADD COLUMN     "subcategoryId" TEXT;

ALTER TABLE "Category"
ADD CONSTRAINT "Category_position_nonnegative_check" CHECK ("position" >= 0);

ALTER TABLE "Product"
ADD CONSTRAINT "Product_stock_nonnegative_check" CHECK ("stock" >= 0);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE INDEX "Category_parentId_position_idx" ON "Category"("parentId", "position");

-- CreateIndex
CREATE INDEX "Product_subcategoryId_idx" ON "Product"("subcategoryId");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION enforce_two_level_category_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_parent_id TEXT;
BEGIN
  IF NEW."parentId" IS NOT NULL THEN
    IF NEW."parentId" = NEW."id" THEN
      RAISE EXCEPTION 'A category cannot be its own parent.'
        USING ERRCODE = '23514';
    END IF;

    SELECT "parentId"
    INTO parent_parent_id
    FROM "Category"
    WHERE "id" = NEW."parentId"
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The parent category does not exist.'
        USING ERRCODE = '23503';
    END IF;
    IF parent_parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'A subcategory cannot be used as a parent category.'
        USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM "Category" child
      WHERE child."parentId" = NEW."id"
    ) OR EXISTS (
      SELECT 1 FROM "Product" product
      WHERE product."categoryId" = NEW."id"
         OR product."subcategoryId" = NEW."id"
    ) THEN
      RAISE EXCEPTION 'A category with dependent records cannot become a subcategory.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."parentId" IS DISTINCT FROM NEW."parentId" THEN
    IF EXISTS (
      SELECT 1
      FROM "Product" product
      WHERE product."subcategoryId" = NEW."id"
        AND product."categoryId" IS DISTINCT FROM NEW."parentId"
    ) THEN
      RAISE EXCEPTION 'A subcategory used by products cannot be moved to a different parent.'
        USING ERRCODE = '23514';
    END IF;
    IF NEW."parentId" IS NULL AND EXISTS (
      SELECT 1 FROM "Product" product
      WHERE product."subcategoryId" = NEW."id"
    ) THEN
      RAISE EXCEPTION 'A subcategory used by products cannot become a main category.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Category_two_level_hierarchy_trigger"
BEFORE INSERT OR UPDATE OF "parentId"
ON "Category"
FOR EACH ROW
EXECUTE FUNCTION enforce_two_level_category_hierarchy();

CREATE FUNCTION enforce_product_category_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  category_parent_id TEXT;
  subcategory_parent_id TEXT;
BEGIN
  SELECT "parentId"
  INTO category_parent_id
  FROM "Category"
  WHERE "id" = NEW."categoryId"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The main category does not exist.'
      USING ERRCODE = '23503';
  END IF;
  IF category_parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'A product must reference a main category.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."subcategoryId" IS NOT NULL THEN
    SELECT "parentId"
    INTO subcategory_parent_id
    FROM "Category"
    WHERE "id" = NEW."subcategoryId"
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The subcategory does not exist.'
        USING ERRCODE = '23503';
    END IF;
    IF subcategory_parent_id IS DISTINCT FROM NEW."categoryId" THEN
      RAISE EXCEPTION 'The subcategory must belong to the selected main category.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Product_category_hierarchy_trigger"
BEFORE INSERT OR UPDATE OF "categoryId", "subcategoryId"
ON "Product"
FOR EACH ROW
EXECUTE FUNCTION enforce_product_category_hierarchy();
