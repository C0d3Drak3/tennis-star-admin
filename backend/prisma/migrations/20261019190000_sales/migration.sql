CREATE TYPE "OrderStatus" AS ENUM ('PREPARING', 'SHIPPED', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'FAILED');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD');

CREATE SEQUENCE "sale_order_number_seq" START WITH 1 INCREMENT BY 1;

ALTER TABLE "Sale"
ADD COLUMN "orderNumber" TEXT,
ADD COLUMN "customerId" TEXT,
ADD COLUMN "customerIdSnapshot" TEXT,
ADD COLUMN "customerFirstName" TEXT,
ADD COLUMN "customerLastName" TEXT,
ADD COLUMN "customerEmail" TEXT,
ADD COLUMN "customerPhone" TEXT,
ADD COLUMN "shippingAddress" TEXT,
ADD COLUMN "shippingCity" TEXT,
ADD COLUMN "shippingPostalCode" TEXT,
ADD COLUMN "carrier" TEXT,
ADD COLUMN "trackingNumber" TEXT,
ADD COLUMN "operationalNotes" TEXT,
ADD COLUMN "paymentMethod" "PaymentMethod",
ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'FAILED',
ADD COLUMN "status" "OrderStatus" NOT NULL DEFAULT 'CANCELLED',
ADD COLUMN "stockDeducted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

WITH numbered_sales AS (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS ordinal
  FROM "Sale"
)
UPDATE "Sale"
SET "orderNumber" = 'ORD-' || lpad(numbered_sales.ordinal::TEXT, 6, '0')
FROM numbered_sales
WHERE "Sale"."id" = numbered_sales."id";

ALTER TABLE "Sale" ALTER COLUMN "orderNumber" SET NOT NULL;
ALTER TABLE "Sale" ALTER COLUMN "updatedAt" DROP DEFAULT;
SELECT setval(
  '"sale_order_number_seq"',
  GREATEST((SELECT count(*) FROM "Sale"), 1),
  (SELECT count(*) > 0 FROM "Sale")
);

ALTER TABLE "SaleItem"
ADD COLUMN "productIdSnapshot" TEXT,
ADD COLUMN "productDescription" TEXT,
ADD COLUMN "brandName" TEXT,
ADD COLUMN "categoryName" TEXT,
ADD COLUMN "subcategoryName" TEXT,
ADD COLUMN "subtotal" DECIMAL(12,2);

UPDATE "SaleItem" SET "productIdSnapshot" = "productId";
UPDATE "SaleItem" SET "subtotal" = "unitPrice" * "quantity";
ALTER TABLE "SaleItem" ALTER COLUMN "subtotal" SET NOT NULL;
ALTER TABLE "SaleItem" ALTER COLUMN "productId" DROP NOT NULL;

ALTER TABLE "SaleItem" DROP CONSTRAINT "SaleItem_productId_fkey";
ALTER TABLE "SaleItem"
ADD CONSTRAINT "SaleItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Sale_orderNumber_key" ON "Sale"("orderNumber");
CREATE INDEX "Sale_status_createdAt_idx" ON "Sale"("status", "createdAt");
CREATE INDEX "Sale_paymentStatus_idx" ON "Sale"("paymentStatus");
CREATE INDEX "SaleItem_productIdSnapshot_idx" ON "SaleItem"("productIdSnapshot");

CREATE TABLE "SaleHistory" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorEmail" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "changes" JSONB NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SaleHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SaleHistory_saleId_createdAt_idx"
ON "SaleHistory"("saleId", "createdAt");

ALTER TABLE "SaleHistory"
ADD CONSTRAINT "SaleHistory_saleId_fkey"
FOREIGN KEY ("saleId") REFERENCES "Sale"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleHistory"
ADD CONSTRAINT "SaleHistory_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SaleItem"
ADD CONSTRAINT "SaleItem_quantity_positive_check" CHECK ("quantity" > 0);
