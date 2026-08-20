INSERT INTO "CoffeeVariety" ("id","speciesId","code","name","updatedAt")
SELECT 'vr_' || md5(s."id" || ':' || v.code), s."id", v.code, v.name, CURRENT_TIMESTAMP
FROM "CoffeeSpecies" s CROSS JOIN (VALUES
 ('BOURBON_AMARELO','Bourbon Amarelo'),('BOURBON_VERMELHO','Bourbon Vermelho'),
 ('CATUAI_AMARELO','Catuaí Amarelo'),('CATUAI_VERMELHO','Catuaí Vermelho'),
 ('MUNDO_NOVO','Mundo Novo'),('ACAIA','Acaiá'),('ARARA','Arara'),('TOPAZIO','Topázio'),
 ('CATUCAI','Catucaí'),('OBATA','Obatã'),('TUPI','Tupi'),('ICATU','Icatu')
) AS v(code,name) WHERE s."code" = 'ARABICA'
ON CONFLICT ("speciesId","code") DO NOTHING;
