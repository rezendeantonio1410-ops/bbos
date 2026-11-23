-- Signa portal — integration test against an ISOLATED PostgreSQL database.
-- Run through scripts/signa-db-integration.sh (refuses non-local hosts).
-- Executes the same SQL statements used by apps/api/src/partner-portal.controller.ts
-- and asserts persistence, scoping, constraints and the Reserva price migration.
-- Everything runs in one transaction and is ROLLED BACK at the end.
\set ON_ERROR_STOP on
BEGIN;

-- ---------- fixtures ----------
INSERT INTO "Company"(id,name,"tradeName","taxId","updatedAt") VALUES
 ('it-co-a','Empresa A','Empresa A','00000000000191',NOW()),
 ('it-co-b','Empresa B','Empresa B','00000000000272',NOW());
INSERT INTO "StorefrontPartner"(id,"companyId",name,email,active,"portalAccessLevel") VALUES
 ('it-signa','it-co-a','Signa Coffee','comercial@nivov.com.br',true,'DISTRIBUTOR'),
 ('it-other','it-co-a','Outro Distribuidor','outro@example.test',true,'DISTRIBUTOR'),
 ('it-co-b-partner','it-co-b','Parceiro B','b@example.test',true,'DISTRIBUTOR');
INSERT INTO "User"(id,"companyId",name,email,"passwordHash","updatedAt") VALUES
 ('it-user-1','it-co-a','Usuário 1','u1@example.test','x',NOW()),
 ('it-user-2','it-co-a','Usuário 2','u2@example.test','x',NOW());
INSERT INTO "Customer"(id,"companyId",name,"updatedAt") VALUES ('it-cust','it-co-a','Signa (CNPJ)',NOW());
INSERT INTO "StorefrontPartnerCustomer"("partnerId","customerId") VALUES ('it-signa','it-cust');

-- ---------- 1. commercial end customer: persistence + scope ----------
INSERT INTO "PartnerEndCustomer"
  (id,"companyId","partnerId",name,"taxId","postalCode",street,number,district,complement,city,state,"createdAt","updatedAt")
VALUES ('it-ec-1','it-co-a','it-signa','Café Central','11222333000181','86010010','Rua Exemplo','25','Centro',NULL,'Londrina','PR',NOW(),NOW());

DO $$
DECLARE r record; n int;
BEGIN
  SELECT * INTO r FROM "PartnerEndCustomer" WHERE id='it-ec-1';
  ASSERT r."taxId"='11222333000181' AND r."postalCode"='86010010' AND r.street='Rua Exemplo'
     AND r.number='25' AND r.district='Centro' AND r.city='Londrina' AND r.state='PR' AND r.active,
     'end customer not persisted with full address';
  -- list query, as in GET /end-customers
  SELECT count(*) INTO n FROM "PartnerEndCustomer" WHERE "companyId"='it-co-a' AND "partnerId"='it-signa' AND active=true;
  ASSERT n=1, 'owner must see its customer';
  SELECT count(*) INTO n FROM "PartnerEndCustomer" WHERE "companyId"='it-co-a' AND "partnerId"='it-other' AND active=true;
  ASSERT n=0, 'another partner must not see it';
  SELECT count(*) INTO n FROM "PartnerEndCustomer" WHERE "companyId"='it-co-b' AND "partnerId"='it-signa' AND active=true;
  ASSERT n=0, 'another company must not see it';
  -- duplicate CNPJ guard query (create, then update of a different record)
  SELECT count(*) INTO n FROM "PartnerEndCustomer"
   WHERE "companyId"='it-co-a' AND "partnerId"='it-signa' AND active=true AND "taxId"='11222333000181'
     AND (NULL::text IS NULL OR id<>NULL::text);
  ASSERT n=1, 'duplicate CNPJ must be detected';
  SELECT count(*) INTO n FROM "PartnerEndCustomer"
   WHERE "companyId"='it-co-a' AND "partnerId"='it-signa' AND active=true AND "taxId"='11222333000181'
     AND ('it-ec-1'::text IS NULL OR id<>'it-ec-1');
  ASSERT n=0, 'editing the same record must not count as duplicate';
  -- PATCH with foreign partner scope updates nothing
  UPDATE "PartnerEndCustomer" SET street='Invasão',"updatedAt"=NOW()
   WHERE id='it-ec-1' AND "companyId"='it-co-a' AND "partnerId"='it-other' AND active=true;
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n=0, 'cross-partner update must touch 0 rows';
  -- PATCH with owner scope
  UPDATE "PartnerEndCustomer" SET number='30',complement='Sala 2',"updatedAt"=NOW()
   WHERE id='it-ec-1' AND "companyId"='it-co-a' AND "partnerId"='it-signa' AND active=true;
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n=1, 'owner update must succeed';
  -- fiscal registry untouched
  SELECT count(*) INTO n FROM "Customer" WHERE "companyId"='it-co-a';
  ASSERT n=1, 'commercial registration must not create fiscal Customer rows';
END $$;

-- ---------- 2. drafts: scope, optimistic version, constraints ----------
INSERT INTO "PartnerOrderDraft"(id,"companyId","partnerId","userId",status,version,payload,"createdAt","updatedAt")
VALUES ('it-draft-1','it-co-a','it-signa','it-user-1','DRAFT',1,'{"items":[]}'::jsonb,NOW(),NOW());
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM "PartnerOrderDraft" WHERE "companyId"='it-co-a' AND "partnerId"='it-signa' AND "userId"='it-user-2' AND status='DRAFT';
  ASSERT n=0, 'another user must not list the draft';
  UPDATE "PartnerOrderDraft" SET payload='{"notes":"x"}'::jsonb,version=version+1,"updatedAt"=NOW()
   WHERE id='it-draft-1' AND "companyId"='it-co-a' AND "partnerId"='it-signa' AND "userId"='it-user-2' AND version=1 AND status='DRAFT';
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n=0, 'another user must not edit the draft';
  UPDATE "PartnerOrderDraft" SET payload='{"notes":"ok"}'::jsonb,version=version+1,"updatedAt"=NOW()
   WHERE id='it-draft-1' AND "companyId"='it-co-a' AND "partnerId"='it-signa' AND "userId"='it-user-1' AND version=1 AND status='DRAFT';
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n=1, 'owner edit with current version';
  UPDATE "PartnerOrderDraft" SET payload='{"notes":"stale"}'::jsonb,version=version+1,"updatedAt"=NOW()
   WHERE id='it-draft-1' AND "companyId"='it-co-a' AND "partnerId"='it-signa' AND "userId"='it-user-1' AND version=1 AND status='DRAFT';
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n=0, 'stale version must not overwrite';
  DELETE FROM "PartnerOrderDraft" WHERE id='it-draft-1' AND "companyId"='it-co-a' AND "partnerId"='it-signa' AND "userId"='it-user-1' AND version=1 AND status='DRAFT';
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n=0, 'stale version must not delete';
  BEGIN
    INSERT INTO "PartnerOrderDraft"(id,"companyId","partnerId","userId",status,payload) VALUES ('it-bad-1','it-co-a','it-signa','it-user-1','SUBMITTED','{}');
    RAISE EXCEPTION 'status check missing';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO "PartnerOrderDraft"(id,"companyId","partnerId","userId",payload) VALUES ('it-bad-2','it-co-a','it-signa','it-user-1','[]');
    RAISE EXCEPTION 'payload check missing';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO "PartnerOrderDraft"(id,"companyId","partnerId","userId",payload) VALUES ('it-bad-3','it-co-a','it-signa','nobody','{}');
    RAISE EXCEPTION 'user FK missing';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;

-- ---------- 3. submission claims: uniqueness and completion invariants ----------
INSERT INTO "SalesOrder"(id,"companyId","customerId",code,quantity,"unitPrice","totalAmount","updatedAt","createdByStorefrontPartnerId")
VALUES ('it-so-1','it-co-a','it-cust','P-IT-000001',1,38,38,NOW(),'it-signa'),
       ('it-so-2','it-co-a','it-cust','P-IT-000002',1,38,38,NOW(),'it-signa');
DO $$
DECLARE n int; h text := repeat('a',64);
BEGIN
  INSERT INTO "PartnerOrderSubmission"(id,"companyId","partnerId","userId","submissionKey","requestHash",status,"createdAt","updatedAt")
  VALUES ('it-sub-1','it-co-a','it-signa','it-user-1','key-0000000000000001',h,'CLAIMED',NOW(),NOW())
  ON CONFLICT ("companyId","partnerId","userId","submissionKey") DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n=1, 'first claim';
  INSERT INTO "PartnerOrderSubmission"(id,"companyId","partnerId","userId","submissionKey","requestHash",status,"createdAt","updatedAt")
  VALUES ('it-sub-dup','it-co-a','it-signa','it-user-1','key-0000000000000001',h,'CLAIMED',NOW(),NOW())
  ON CONFLICT ("companyId","partnerId","userId","submissionKey") DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n=0, 'same scoped key must not claim twice';
  -- same key for another user is a different scope
  INSERT INTO "PartnerOrderSubmission"(id,"companyId","partnerId","userId","submissionKey","requestHash",status,"createdAt","updatedAt")
  VALUES ('it-sub-u2','it-co-a','it-signa','it-user-2','key-0000000000000001',h,'CLAIMED',NOW(),NOW())
  ON CONFLICT ("companyId","partnerId","userId","submissionKey") DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n=1, 'scope includes user';
  BEGIN
    UPDATE "PartnerOrderSubmission" SET status='COMPLETED' WHERE id='it-sub-1';
    RAISE EXCEPTION 'completion check missing';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE "PartnerOrderSubmission" SET status='COMPLETED',"salesOrderId"='it-so-1',"completedAt"=NOW(),"updatedAt"=NOW()
   WHERE id='it-sub-1' AND "companyId"='it-co-a' AND "partnerId"='it-signa' AND status='CLAIMED';
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n=1, 'completion';
  BEGIN
    UPDATE "PartnerOrderSubmission" SET status='COMPLETED',"salesOrderId"='it-so-1',"completedAt"=NOW() WHERE id='it-sub-u2';
    RAISE EXCEPTION 'one order per submission missing';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO "PartnerOrderSubmission"(id,"companyId","partnerId","userId","submissionKey","requestHash")
    VALUES ('it-bad-h','it-co-a','it-signa','it-user-1','key-0000000000000009','NOT-A-HASH');
    RAISE EXCEPTION 'hash check missing';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    DELETE FROM "SalesOrder" WHERE id='it-so-1';
    RAISE EXCEPTION 'order with submission must not be deletable';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  -- replay lookup used by the API
  SELECT count(*) INTO n FROM "PartnerOrderSubmission" s JOIN "SalesOrder" so ON so.id=s."salesOrderId"
   WHERE s."companyId"='it-co-a' AND s."partnerId"='it-signa' AND s."userId"='it-user-1'
     AND s."submissionKey"='key-0000000000000001' AND so."createdByStorefrontPartnerId"='it-signa';
  ASSERT n=1, 'replay lookup';
END $$;

-- ---------- 4. Reserva prices (migration re-applied on fixtures) ----------
INSERT INTO "ProductLine"(id,"companyId",code,name,slug,description,positioning,"sortOrder","updatedAt")
VALUES ('it-line','it-co-a','RAROS','Raros','raros','-','-',1,NOW());
INSERT INTO "Product"(id,"productLineId",name,slug,description,"updatedAt",code,active)
VALUES ('it-prod','it-line','Reserva','reserva','-',NOW(),'WHITE_LABEL_RARO',true);
INSERT INTO "ProductVariant"(id,"productId",sku,"netWeightGrams","grossWeightGrams","salesUnit","updatedAt",active)
VALUES ('it-var-250','it-prod','RAR-WLR-250',250,250,'UN',NOW(),true);
INSERT INTO "CustomerProductPrice"(id,"companyId","customerId","productVariantId",currency,price,active)
VALUES ('it-cpp-250','it-co-a','it-cust','it-var-250','BRL',38.00,true);
INSERT INTO "CustomerCatalogProduct"(id,"companyId","customerId","productVariantId","displayLineName","displayProductName","sortOrder",active,"updatedAt")
VALUES ('it-cat-250','it-co-a','it-cust','it-var-250','Reserva','Reserva',41,true,NOW());
\ir ../migrations/20261122153000_signa_reserva_500_1000/migration.sql
DO $$
DECLARE p250 numeric; p500 numeric; p1000 numeric;
BEGIN
  SELECT price INTO p250 FROM "CustomerProductPrice" c JOIN "ProductVariant" v ON v.id=c."productVariantId" WHERE c."customerId"='it-cust' AND v.sku='RAR-WLR-250' AND c.active;
  SELECT price INTO p500 FROM "CustomerProductPrice" c JOIN "ProductVariant" v ON v.id=c."productVariantId" WHERE c."customerId"='it-cust' AND v.sku='RAR-WLR-500' AND c.active;
  SELECT price INTO p1000 FROM "CustomerProductPrice" c JOIN "ProductVariant" v ON v.id=c."productVariantId" WHERE c."customerId"='it-cust' AND v.sku='RAR-WLR-1000' AND c.active;
  ASSERT p250=38.00 AND p500=76.80 AND p1000=148.00, format('Reserva prices %s / %s / %s', p250, p500, p1000);
END $$;

\echo 'signa-portal-db-integration: ALL ASSERTIONS PASSED'
ROLLBACK;
