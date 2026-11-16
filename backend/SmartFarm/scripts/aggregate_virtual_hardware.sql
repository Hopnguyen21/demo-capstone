BEGIN;
WITH groups AS (
  SELECT * FROM (VALUES
    ('DHT-%','DHT-BULK','DHT Temperature Humidity','DHT22'),
    ('SOIL-%','SOIL-BULK','Soil Moisture','Capacitive Soil v1'),
    ('ECPH-%','ECPH-BULK','EC pH Soil','EC-pH Combo'),
    ('LIGHT-%','LIGHT-BULK','Light Sensor','BH1750'),
    ('RELAY-%','RELAY-BULK','Relay Controller','Relay 4CH')
  ) AS v(pattern, code, name, model)
), keepers AS (
  SELECT DISTINCT ON (g.code) p."Id", g.code, g.name, g.model
  FROM "PlatformHardwareItems" p
  JOIN groups g ON p."Code" LIKE g.pattern
  ORDER BY g.code, p."Code"
), totals AS (
  SELECT k."Id", SUM(p."QuantityInStock")::int AS qty
  FROM keepers k
  JOIN groups g ON g.code=k.code
  JOIN "PlatformHardwareItems" p ON p."Code" LIKE g.pattern
  GROUP BY k."Id"
)
UPDATE "PlatformHardwareItems" p
SET "Code"=k.code, "Name"=k.name, "Model"=k.model, "SerialNumber"=NULL, "MacAddress"=NULL,
    "QuantityInStock"=t.qty, "Status"='InWarehouse', "AssignedTechnicianId"=NULL,
    "LocationRack"='TECH-VIRTUAL', "UpdatedAtUtc"=NOW()
FROM keepers k JOIN totals t ON t."Id"=k."Id"
WHERE p."Id"=k."Id";

DELETE FROM "PlatformHardwareItems" p
WHERE (p."Code" LIKE 'DHT-%' OR p."Code" LIKE 'SOIL-%' OR p."Code" LIKE 'ECPH-%' OR p."Code" LIKE 'LIGHT-%' OR p."Code" LIKE 'RELAY-%')
  AND p."Code" NOT IN ('DHT-BULK','SOIL-BULK','ECPH-BULK','LIGHT-BULK','RELAY-BULK');
COMMIT;
SELECT COUNT(*) AS rows, COALESCE(SUM("QuantityInStock"),0) AS total_units FROM "PlatformHardwareItems";
SELECT "Code","Name","QuantityInStock","Status" FROM "PlatformHardwareItems" WHERE "Code" IN ('DHT-BULK','SOIL-BULK','ECPH-BULK','LIGHT-BULK','RELAY-BULK') ORDER BY "Code";
