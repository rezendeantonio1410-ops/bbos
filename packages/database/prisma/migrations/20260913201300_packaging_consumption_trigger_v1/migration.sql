CREATE OR REPLACE FUNCTION bbos_register_packaging_consumption() RETURNS trigger AS $$
DECLARE material_key TEXT; material_id TEXT; is_tracked BOOLEAN; available_qty DECIMAL(14,3);
BEGIN
  material_key := COALESCE(NULLIF(trim(NEW.sku),''),lower(trim(NEW."materialName")));
  material_id := 'pkgmat-'||md5(NEW."companyId"||':'||material_key);
  INSERT INTO "PackagingMaterial"(id,"companyId","materialKey",name,sku,category,unit)
  VALUES(material_id,NEW."companyId",material_key,NEW."materialName",NEW.sku,upper(COALESCE(NEW."materialType",'OTHER')),NEW.unit)
  ON CONFLICT ("companyId","materialKey") DO UPDATE SET name=EXCLUDED.name,sku=COALESCE(EXCLUDED.sku,"PackagingMaterial".sku),"updatedAt"=CURRENT_TIMESTAMP;
  INSERT INTO "PackagingInventoryBalance"(id,"companyId","materialId") VALUES('pkgbal-'||md5(material_id),NEW."companyId",material_id) ON CONFLICT ("materialId") DO NOTHING;
  SELECT m.tracked,(b."onHand"-b.reserved) INTO is_tracked,available_qty FROM "PackagingMaterial" m JOIN "PackagingInventoryBalance" b ON b."materialId"=m.id WHERE m.id=material_id FOR UPDATE;
  IF is_tracked AND NEW.quantity>available_qty THEN RAISE EXCEPTION 'Estoque insuficiente do insumo %',NEW."materialName"; END IF;
  IF is_tracked THEN UPDATE "PackagingInventoryBalance" SET "onHand"="onHand"-NEW.quantity,"updatedAt"=CURRENT_TIMESTAMP WHERE "materialId"=material_id; END IF;
  INSERT INTO "PackagingMovement"(id,"companyId","materialId","productionOrderId",type,quantity,"unitCost",reason)
  VALUES('pkgmov-'||md5(NEW.id),NEW."companyId",material_id,NEW."productionOrderId",'CONSUMPTION',NEW.quantity,NEW."unitCost",'Consumo confirmado na OP') ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "PackagingConsumption_inventory_trg" ON "PackagingConsumption";
CREATE TRIGGER "PackagingConsumption_inventory_trg" AFTER INSERT ON "PackagingConsumption" FOR EACH ROW EXECUTE FUNCTION bbos_register_packaging_consumption();
