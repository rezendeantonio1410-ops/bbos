-- Storefront state machine and active-attempt guard.

-- Only one active payment attempt can exist for a business order.
CREATE UNIQUE INDEX IF NOT EXISTS "StorefrontPaymentAttempt_one_active_per_order"
  ON "StorefrontPaymentAttempt"("storefrontOrderId")
  WHERE status IN ('CREATING','AWAITING_PAYMENT','PROCESSING');

CREATE OR REPLACE FUNCTION "bbos_validate_storefront_order_transition"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF
    (OLD.status = 'AWAITING_PAYMENT' AND NEW.status IN ('PAID','PAYMENT_FAILED','EXCEPTION','CANCELLED')) OR
    (OLD.status = 'PAYMENT_FAILED' AND NEW.status IN ('AWAITING_PAYMENT','PAID','EXCEPTION','CANCELLED')) OR
    (OLD.status = 'EXCEPTION' AND NEW.status IN ('AWAITING_PAYMENT','PAID','CANCELLED')) OR
    (OLD.status = 'CANCELLED' AND NEW.status = 'PAID') OR
    (OLD.status = 'PAID' AND NEW.status IN ('PREPARING','EXCEPTION')) OR
    (OLD.status = 'PREPARING' AND NEW.status IN ('INVOICED','EXCEPTION','CANCELLED')) OR
    (OLD.status = 'INVOICED' AND NEW.status IN ('SHIPPED','EXCEPTION')) OR
    (OLD.status = 'SHIPPED' AND NEW.status IN ('DELIVERED','EXCEPTION')) OR
    (OLD.status = 'DELIVERED' AND NEW.status = 'DELIVERED')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid StorefrontOrder status transition: % -> % for %',
    OLD.status, NEW.status, OLD.id
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS "StorefrontOrder_status_transition_guard" ON "StorefrontOrder";
CREATE TRIGGER "StorefrontOrder_status_transition_guard"
BEFORE UPDATE OF status ON "StorefrontOrder"
FOR EACH ROW
EXECUTE FUNCTION "bbos_validate_storefront_order_transition"();

CREATE OR REPLACE FUNCTION "bbos_validate_payment_attempt_transition"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Provider truth is allowed to recover any local non-paid state to PAID.
  IF NEW.status = 'PAID' AND OLD.status <> 'PAID' THEN
    RETURN NEW;
  END IF;

  IF
    (OLD.status = 'CREATING' AND NEW.status IN ('AWAITING_PAYMENT','ERROR','FAILED','CANCELLED')) OR
    (OLD.status = 'AWAITING_PAYMENT' AND NEW.status IN ('PROCESSING','FAILED','CANCELLED','EXPIRED','ERROR')) OR
    (OLD.status = 'PROCESSING' AND NEW.status IN ('AWAITING_PAYMENT','FAILED','CANCELLED','EXPIRED','ERROR')) OR
    (OLD.status = 'ERROR' AND NEW.status IN ('PROCESSING','FAILED','CANCELLED','EXPIRED')) OR
    (OLD.status = 'FAILED' AND NEW.status IN ('PROCESSING','CANCELLED')) OR
    (OLD.status = 'CANCELLED' AND NEW.status IN ('PROCESSING')) OR
    (OLD.status = 'EXPIRED' AND NEW.status IN ('PROCESSING'))
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid StorefrontPaymentAttempt transition: % -> % for %',
    OLD.status, NEW.status, OLD.id
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS "StorefrontPaymentAttempt_status_transition_guard"
  ON "StorefrontPaymentAttempt";
CREATE TRIGGER "StorefrontPaymentAttempt_status_transition_guard"
BEFORE UPDATE OF status ON "StorefrontPaymentAttempt"
FOR EACH ROW
EXECUTE FUNCTION "bbos_validate_payment_attempt_transition"();
