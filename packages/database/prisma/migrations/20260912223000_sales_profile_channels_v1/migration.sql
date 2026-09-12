-- Ensure every customer commercial profile has a matching pricing channel.
-- Exact channel code, not SalesChannelType, is the source of truth for customer-profile pricing.
INSERT INTO "SalesChannel" (id, "companyId", code, name, type, active, country, currency, "createdAt", "updatedAt")
SELECT 'profile-' || md5(c.id || ':' || p.code), c.id, p.code, p.name, p.type::"SalesChannelType", true, CASE WHEN p.code='EXPORTACAO' THEN NULL ELSE 'Brasil' END, CASE WHEN p.code='EXPORTACAO' THEN 'USD' ELSE 'BRL' END, NOW(), NOW()
FROM "Company" c
CROSS JOIN (VALUES
  ('DISTRIBUIDOR','Distribuidor','DISTRIBUIDOR'),
  ('CAFETERIA','Cafeteria','CAFETERIA'),
  ('ESCRITORIO','Escritório','ESCRITORIO'),
  ('VAREJO','Varejo','OUTRO'),
  ('RESTAURANTE_HOTEL','Restaurante / Hotel','OUTRO'),
  ('WHITE_LABEL','White Label','OUTRO'),
  ('EXPORTACAO','Exportação','EXPORTACAO'),
  ('CONSUMIDOR_FINAL','Consumidor final','OUTRO'),
  ('OUTRO','Outro','OUTRO')
) AS p(code,name,type)
WHERE NOT EXISTS (
  SELECT 1 FROM "SalesChannel" sc WHERE sc."companyId"=c.id AND sc.code=p.code
);
