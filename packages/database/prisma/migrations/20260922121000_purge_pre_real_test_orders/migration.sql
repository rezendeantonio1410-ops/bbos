-- One-time cleanup of BBOS test orders before real operational testing.
-- Explicit IDs only: safe on future databases because unrelated orders are untouched.

DELETE FROM "IntegrationOutbox"
 WHERE "aggregateId" IN (
   'cmubgw4me0001ne4lavyqyn36',
   'cmubh4hm70005ne4lv3j6dggj',
   'fiscal-out-d134e223357bda42b045019be2601a42'
 );

DELETE FROM "IntegrationResourceMap"
 WHERE provider='BLING'
   AND "internalKey" IN (
     'cmubgw4me0001ne4lavyqyn36',
     'cmubh4hm70005ne4lv3j6dggj',
     'fiscal-out-d134e223357bda42b045019be2601a42'
   );

DELETE FROM "AccountsReceivable"
 WHERE "salesOrderId" IN (
   'cmubgw4me0001ne4lavyqyn36',
   'cmubh4hm70005ne4lv3j6dggj'
 );

DELETE FROM "InventoryReservation"
 WHERE "salesOrderId" IN (
   'cmubgw4me0001ne4lavyqyn36',
   'cmubh4hm70005ne4lv3j6dggj'
 );

DELETE FROM "FiscalDocument"
 WHERE id='fiscal-out-d134e223357bda42b045019be2601a42'
    OR "salesOrderId" IN (
      'cmubgw4me0001ne4lavyqyn36',
      'cmubh4hm70005ne4lv3j6dggj'
    );

DELETE FROM "SalesOrder"
 WHERE id IN (
   'cmubgw4me0001ne4lavyqyn36',
   'cmubh4hm70005ne4lv3j6dggj'
 );
