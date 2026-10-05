-- Reset the Bispo storefront coupon catalog before the commercial launch.
-- Partners are preserved. Coupons are archived before removal.
-- Any coupon that acquires an order/redemption before this migration aborts
-- the cleanup rather than losing commercial history.

LOCK TABLE "StorefrontCoupon" IN ACCESS EXCLUSIVE MODE;

INSERT INTO "DataCleanupArchive" ("cleanupKey", "tableName", "recordId", payload)
SELECT
  '2026-10-05-storefront-coupon-reset',
  'StorefrontCoupon',
  coupon.id,
  to_jsonb(coupon)
FROM "StorefrontCoupon" coupon
JOIN "Company" company ON company.id = coupon."companyId"
WHERE company."taxId" = '13.008.726/0001-12'
ON CONFLICT ("cleanupKey", "tableName", "recordId") DO NOTHING;

DELETE FROM "StorefrontCoupon" coupon
USING "Company" company
WHERE coupon."companyId" = company.id
  AND company."taxId" = '13.008.726/0001-12'
  AND NOT EXISTS (
    SELECT 1
    FROM "StorefrontCouponRedemption" redemption
    WHERE redemption."couponId" = coupon.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "StorefrontOrder" storefront_order
    WHERE storefront_order."couponId" = coupon.id
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "StorefrontCoupon" coupon
    JOIN "Company" company ON company.id = coupon."companyId"
    WHERE company."taxId" = '13.008.726/0001-12'
  ) THEN
    RAISE EXCEPTION 'Coupon reset stopped: a coupon acquired commercial history during deployment';
  END IF;
END $$;
