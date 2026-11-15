-- Remove only the known pre-production/test orders that existed before real BBOS testing.
-- This migration intentionally targets fixed IDs so new real orders created later are not affected.

DELETE FROM "StorefrontCouponRedemption"
WHERE "storefrontOrderId" IN (
  '8c185fed-2b9b-4df4-9fd1-c57861d77011',
  '938e67be-0547-4ec8-98ea-bf270c803814',
  '988b0a2c-4d07-43df-923a-5c5a8d724c2f',
  'd121afb4-3ceb-4ca5-a9a2-d0912181f679',
  'afb55a4e-8068-40e8-b1e3-8b590903f085',
  'e901a515-3e61-45c5-aae6-9ff238ca85be'
);

DELETE FROM "InventoryReservation"
WHERE "salesOrderId" IN (
  'cmtzt01cf0001mr34ljpev215',
  'cmu8fblv1000jo14kav59smxz',
  'cmu8fbluq000do14ktnkdtgwy',
  'cmu8fblu10003o14kqcmln3qv',
  'cmu8fbluf0009o14kdbclaf86',
  'cmu8fblvc000no14kaeecaw3f',
  'cmu8fblvn000ro14k6gxh6nne'
);

DELETE FROM "StorefrontOrder"
WHERE id IN (
  '8c185fed-2b9b-4df4-9fd1-c57861d77011',
  '938e67be-0547-4ec8-98ea-bf270c803814',
  '988b0a2c-4d07-43df-923a-5c5a8d724c2f',
  'd121afb4-3ceb-4ca5-a9a2-d0912181f679',
  'afb55a4e-8068-40e8-b1e3-8b590903f085',
  'e901a515-3e61-45c5-aae6-9ff238ca85be'
);

DELETE FROM "SalesOrder"
WHERE id IN (
  'cmtzt01cf0001mr34ljpev215',
  'cmu8fblv1000jo14kav59smxz',
  'cmu8fbluq000do14ktnkdtgwy',
  'cmu8fblu10003o14kqcmln3qv',
  'cmu8fbluf0009o14kdbclaf86',
  'cmu8fblvc000no14kaeecaw3f',
  'cmu8fblvn000ro14k6gxh6nne'
);
