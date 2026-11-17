DO $$
DECLARE
  target_user RECORD;
  target_partner_id TEXT;
BEGIN
  SELECT id, "companyId", "storefrontPartnerId", name, email
    INTO target_user
    FROM "User"
   WHERE lower(email) = 'mdiniz@bispocoffees.com'
     AND role = 'SALES'
     AND active = true
   LIMIT 1;

  IF target_user.id IS NULL THEN
    RETURN;
  END IF;

  target_partner_id := target_user."storefrontPartnerId";

  IF target_partner_id IS NULL THEN
    SELECT id
      INTO target_partner_id
      FROM "StorefrontPartner"
     WHERE "companyId" = target_user."companyId"
       AND lower(coalesce(email, '')) = lower(target_user.email)
     ORDER BY "createdAt" ASC
     LIMIT 1;
  END IF;

  IF target_partner_id IS NULL THEN
    target_partner_id := 'sales-portfolio-' || target_user.id;

    INSERT INTO "StorefrontPartner" (
      id, "companyId", name, "contactName", email, active,
      "isSalesPartner", "isSalesBroker", "isGreenCoffeeBroker",
      "portalAccessLevel", "createdAt", "updatedAt"
    ) VALUES (
      target_partner_id, target_user."companyId", target_user.name,
      target_user.name, lower(target_user.email), true,
      true, true, false, 'SELLER', NOW(), NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  UPDATE "StorefrontPartner"
     SET active = true,
         "isSalesPartner" = true,
         "isSalesBroker" = true,
         "updatedAt" = NOW()
   WHERE id = target_partner_id
     AND "companyId" = target_user."companyId";

  INSERT INTO "Broker" (
    id, "companyId", "businessPartnerId", name, "contactName", email,
    active, "createdAt", "updatedAt"
  )
  SELECT
    'broker-' || target_user.id, partner."companyId", partner.id, partner.name,
    partner."contactName", partner.email, true, NOW(), NOW()
  FROM "StorefrontPartner" partner
  WHERE partner.id = target_partner_id
    AND partner."companyId" = target_user."companyId"
  ON CONFLICT ("businessPartnerId") DO UPDATE
    SET active = true,
        name = EXCLUDED.name,
        "contactName" = EXCLUDED."contactName",
        email = EXCLUDED.email,
        "updatedAt" = NOW();

  UPDATE "User"
     SET "storefrontPartnerId" = target_partner_id,
         "updatedAt" = NOW()
   WHERE id = target_user.id
     AND "companyId" = target_user."companyId";
END $$;
