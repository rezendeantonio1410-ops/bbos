WITH latest_decision AS (
  SELECT DISTINCT ON ("customerId")
    "customerId",
    "decisionStatus",
    "decidedLimit",
    "decisionTerms",
    "createdAt"
  FROM "CustomerCreditEvent"
  WHERE "eventType" = 'DECISION'
  ORDER BY "customerId", "createdAt" DESC
),
latest_request AS (
  SELECT DISTINCT ON ("customerId")
    "customerId",
    "createdAt"
  FROM "CustomerCreditEvent"
  WHERE "eventType" = 'REQUEST'
  ORDER BY "customerId", "createdAt" DESC
)
UPDATE "Customer" c
SET "creditStatus" = 'APPROVED',
    "creditLimit" = COALESCE(d."decidedLimit", c."creditLimit"),
    "paymentTerms" = COALESCE(d."decisionTerms", c."paymentTerms"),
    "updatedAt" = NOW()
FROM latest_decision d
JOIN latest_request r ON r."customerId" = d."customerId"
WHERE c.id = d."customerId"
  AND c."creditStatus" = 'UNDER_REVIEW'
  AND d."decisionStatus" = 'APPROVED'
  AND r."createdAt" > d."createdAt";
