ALTER TABLE "Sale" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "Sale_idempotencyKey_key" ON "Sale"("idempotencyKey");
