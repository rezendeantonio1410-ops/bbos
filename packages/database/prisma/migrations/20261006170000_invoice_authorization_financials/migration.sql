-- Financial effects must follow an authorized invoice, not merely an emission request.
-- The API/Bling worker changes SalesOrder to INVOICED only after SEFAZ authorization.

CREATE OR REPLACE FUNCTION bbos_finalize_authorized_sale_financials()
RETURNS trigger AS $$
DECLARE
  issue_date TIMESTAMP(3) := COALESCE(NEW."invoicedAt", CURRENT_TIMESTAMP);
  due_date TIMESTAMP(3);
  max_days INTEGER;
  payable_key TEXT;
BEGIN
  IF NEW.status::text <> 'INVOICED'
     OR OLD.status::text = 'INVOICED'
     OR NEW."orderType" = 'SAMPLE' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW."paymentType", 'LEGACY') = 'CASH' THEN
    max_days := 0;
  ELSIF COALESCE(NEW."paymentType", 'LEGACY') = 'TERM' THEN
    SELECT MAX((m)[1]::int)
      INTO max_days
      FROM regexp_matches(COALESCE(NEW."paymentTermsSnapshot", ''), '([0-9]+)', 'g') AS m;
    max_days := COALESCE(max_days, 30);
  ELSE
    max_days := 30;
  END IF;
  due_date := issue_date + make_interval(days => max_days);

  INSERT INTO "AccountsReceivable" (
    id,"companyId","customerId","salesOrderId","issueDate","dueDate",
    amount,"openAmount",status,"createdAt","updatedAt"
  ) VALUES (
    'ar-' || md5(NEW.id), NEW."companyId", NEW."customerId", NEW.id,
    issue_date, due_date, NEW."totalAmount", NEW."totalAmount", 'OPEN', NOW(), NOW()
  )
  ON CONFLICT ("salesOrderId") DO NOTHING;

  IF NEW."brokerId" IS NOT NULL
     AND COALESCE(NEW."brokerCommissionAmount", 0) > 0 THEN
    payable_key := 'sales-order:' || NEW.id || ':broker-commission';
    INSERT INTO "AccountsPayable" (
      id,"companyId","brokerId","supplierId","brokerCommissionPayableKey",
      description,"issueDate","dueDate",amount,"openAmount",status,category,notes,
      "createdAt","updatedAt"
    ) VALUES (
      'ap-' || md5(payable_key), NEW."companyId", NEW."brokerId", NULL, payable_key,
      COALESCE(NEW."orderNumber", NEW.code) || ' · comissão de corretagem da venda',
      issue_date, issue_date, NEW."brokerCommissionAmount", NEW."brokerCommissionAmount",
      'OPEN', 'COMISSAO_VENDA',
      CASE
        WHEN NEW."brokerCommissionMode" = 'PER_PACKAGE'
          THEN 'Comissão por pacote vendido.'
        ELSE 'Comissão percentual sobre os produtos do pedido.'
      END,
      NOW(), NOW()
    )
    ON CONFLICT ("brokerCommissionPayableKey") DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "SalesOrder_zz_authorized_financials_trg" ON "SalesOrder";
CREATE TRIGGER "SalesOrder_zz_authorized_financials_trg"
AFTER UPDATE OF status ON "SalesOrder"
FOR EACH ROW EXECUTE FUNCTION bbos_finalize_authorized_sale_financials();
