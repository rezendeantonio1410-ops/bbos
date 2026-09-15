INSERT INTO "RoastedWipLot"(id,"companyId","productionOrderId","productionBatchId","productVariantId",code,"producedKg","availableKg","producedAt",status)
SELECT 'wip-'||md5(pb.id),pb."companyId",pb."productionOrderId",pb.id,po."productVariantId",'WIP-'||pb.code,pb."roastedOutputKg",pb."roastedOutputKg",COALESCE(pb."completedAt",CURRENT_TIMESTAMP),'AVAILABLE'
FROM "ProductionBatch" pb
JOIN "ProductionOrder" po ON po.id=pb."productionOrderId"
WHERE po.status::text NOT IN ('COMPLETED','CANCELLED')
  AND NOT EXISTS (SELECT 1 FROM "RoastedWipLot" w WHERE w."productionBatchId"=pb.id)
ON CONFLICT ("productionBatchId") DO NOTHING;

INSERT INTO "RoastedWipMovement"(id,"companyId","wipLotId","productionOrderId",type,"quantityKg",reason,metadata)
SELECT 'wipmov-'||md5('ROAST:'||pb.id),pb."companyId",'wip-'||md5(pb.id),pb."productionOrderId",'ROAST_IN',pb."roastedOutputKg",'Backfill de torra anterior ao controle WIP',jsonb_build_object('migration','20260913202700')
FROM "ProductionBatch" pb
JOIN "ProductionOrder" po ON po.id=pb."productionOrderId"
WHERE po.status::text NOT IN ('COMPLETED','CANCELLED')
  AND EXISTS (SELECT 1 FROM "RoastedWipLot" w WHERE w."productionBatchId"=pb.id)
ON CONFLICT (id) DO NOTHING;
