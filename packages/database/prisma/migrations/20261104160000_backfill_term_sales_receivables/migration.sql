-- An authorized NF-e for a term sale must always have one financial title.
-- Backfill historical orders so their collection PDF is immediately available.
INSERT INTO "AccountsReceivable" (
  id,"companyId","customerId","salesOrderId","invoiceId","issueDate","dueDate",
  amount,"openAmount",status,notes,"createdAt","updatedAt"
)
SELECT
  'ar-term-' || md5(sales_order.id),
  sales_order."companyId",
  sales_order."customerId",
  sales_order.id,
  fiscal.number,
  COALESCE(sales_order."invoicedAt",fiscal."updatedAt",NOW()),
  COALESCE(sales_order."invoicedAt",fiscal."updatedAt",NOW())
    + make_interval(days => LEAST(365,GREATEST(1,COALESCE(
        (substring(COALESCE(sales_order."paymentTermsSnapshot",'') FROM '([0-9]{1,3})'))::integer,
        30
      )))),
  sales_order."totalAmount",
  sales_order."totalAmount",
  'OPEN'::"ReceivableStatus",
  'Título criado automaticamente após autorização da NF-e.',
  NOW(),
  NOW()
FROM "SalesOrder" sales_order
JOIN LATERAL (
  SELECT document.number,document."updatedAt"
    FROM "FiscalDocument" document
   WHERE document."companyId"=sales_order."companyId"
     AND document."salesOrderId"=sales_order.id
     AND document.direction='OUTBOUND'
     AND document.status='AUTHORIZED'
     AND document.number IS NOT NULL
   ORDER BY document."createdAt" DESC
   LIMIT 1
) fiscal ON TRUE
WHERE sales_order."paymentType"='TERM'
  AND sales_order."orderType"<>'SAMPLE'
  AND sales_order.status IN ('INVOICED','SHIPPED','DELIVERED')
ON CONFLICT ("salesOrderId") DO NOTHING;
