CREATE TABLE "StorefrontProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "useInHero" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StorefrontProductImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StorefrontProductImage_productId_sortOrder_idx"
ON "StorefrontProductImage"("productId", "sortOrder");

CREATE INDEX "StorefrontProductImage_productId_isPrimary_idx"
ON "StorefrontProductImage"("productId", "isPrimary");

CREATE INDEX "StorefrontProductImage_productId_useInHero_idx"
ON "StorefrontProductImage"("productId", "useInHero");

ALTER TABLE "StorefrontProductImage"
ADD CONSTRAINT "StorefrontProductImage_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
