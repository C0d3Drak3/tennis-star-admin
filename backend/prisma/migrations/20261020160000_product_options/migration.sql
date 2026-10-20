CREATE TABLE "ProductOption" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "values" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductOption_productId_idx" ON "ProductOption"("productId");

ALTER TABLE "ProductOption"
ADD CONSTRAINT "ProductOption_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
