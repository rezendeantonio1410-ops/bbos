-- Sample orders carry a symbolic fiscal value for NF-e purposes, but they do
-- not create commercial payment schedules or receivables.

CREATE OR REPLACE FUNCTION bbos_build_sales_payment_schedule() RETURNS trigger AS $$
DECLARE
  days_array INTEGER[];
  d INTEGER;
  idx INTEGER := 0;
  count_terms INTEGER;
  base_amount NUMERIC(14,2);
  remaining NUMERIC(14,2);
  issue_date TIMESTAMP(3) := COALESCE(NEW."invoicedAt", CURRENT_TIMESTAMP);
BEGIN
  IF NEW.status::text <> 'INVOICED' OR OLD.status::text = 'INVOICED' THEN
    RETURN NEW;
  END IF;

  DELETE FROM "SalesOrderPaymentSchedule" WHERE "salesOrderId" = NEW.id;

  IF NEW."orderType" = 'SAMPLE' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW."paymentType", 'CASH') = 'CASH' THEN
    days_array := ARRAY[0];
  ELSE
    SELECT array_agg((m)[1]::int)
      INTO days_array
      FROM regexp_matches(
        COALESCE(NEW."paymentTermsSnapshot", ''),
        '([0-9]+)',
        'g'
      ) AS m;

    IF days_array IS NULL OR cardinality(days_array) = 0 THEN
      RAISE EXCEPTION 'Condição a prazo sem dias reconhecíveis';
    END IF;
  END IF;

  count_terms := cardinality(days_array);
  base_amount := trunc((NEW."totalAmount"::numeric / count_terms) * 100) / 100;
  remaining := NEW."totalAmount"::numeric;

  FOREACH d IN ARRAY days_array LOOP
    idx := idx + 1;
    INSERT INTO "SalesOrderPaymentSchedule"(
      id,
      "companyId",
      "salesOrderId",
      installment,
      "dueDate",
      amount
    ) VALUES (
      'sops-' || md5(NEW.id || ':' || idx::text),
      NEW."companyId",
      NEW.id,
      idx,
      issue_date + make_interval(days => d),
      CASE WHEN idx = count_terms THEN remaining ELSE base_amount END
    );
    remaining := remaining - base_amount;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
