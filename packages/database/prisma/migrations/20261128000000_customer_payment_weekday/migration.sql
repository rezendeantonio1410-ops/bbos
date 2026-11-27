-- Dia fixo de pagamento do cliente (ex.: hospital que só paga às quintas).
-- Aditivo: coluna opcional + gatilho que empurra o vencimento das parcelas
-- a prazo para o próximo dia permitido (nunca antecipa). Clientes sem dia
-- definido e vendas à vista não mudam. Títulos já criados não são alterados.

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "paymentWeekday" SMALLINT;

DO $$ BEGIN
  ALTER TABLE "Customer" ADD CONSTRAINT "Customer_paymentWeekday_check"
    CHECK ("paymentWeekday" IS NULL OR "paymentWeekday" BETWEEN 0 AND 6);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION bbos_payment_weekday_due() RETURNS trigger AS $$
DECLARE
  weekday SMALLINT;
  payment_type TEXT;
  local_day DATE;
  shift INTEGER;
BEGIN
  SELECT c."paymentWeekday", so."paymentType"
    INTO weekday, payment_type
    FROM "SalesOrder" so
    JOIN "Customer" c ON c.id = so."customerId"
   WHERE so.id = NEW."salesOrderId";
  IF weekday IS NULL OR COALESCE(payment_type, 'CASH') <> 'TERM' THEN
    RETURN NEW;
  END IF;
  -- Datas gravadas em UTC; o dia da semana vale no horário de São Paulo.
  local_day := ((NEW."dueDate" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date;
  shift := (weekday - EXTRACT(DOW FROM local_day)::int + 7) % 7;
  IF shift > 0 THEN
    NEW."dueDate" := NEW."dueDate" + make_interval(days => shift);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "SalesOrderPaymentSchedule_payment_weekday_trg" ON "SalesOrderPaymentSchedule";
CREATE TRIGGER "SalesOrderPaymentSchedule_payment_weekday_trg"
BEFORE INSERT ON "SalesOrderPaymentSchedule"
FOR EACH ROW EXECUTE FUNCTION bbos_payment_weekday_due();
