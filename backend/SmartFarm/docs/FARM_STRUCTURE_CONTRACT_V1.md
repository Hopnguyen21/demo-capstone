# SmartFarm Farm Field Zone Contract v1

This contract resolves the Farm, Field and Zone gaps between Flow 1 and endpoints #16-#32 in `reference/API .docx`.

## Scope and tenant authority

Endpoints #16-#21 and #23-#32 are implemented in this slice. Endpoint #22 submit is deferred because its source rule requires an InProgress planting season and an IoT provisioning workflow that are not part of this slice.

Every endpoint requires `FarmOwner`. The Tenant ID is read from the authenticated JWT and is checked against the active Owner account. A client-supplied Tenant ID is never accepted. Field access resolves Field → Farm → Tenant and Zone access resolves Zone → Field → Farm → Tenant. A resource outside the current Tenant returns 404.

## Boundary storage

Flow 1 requires Field boundaries and endpoint #29 requires a Zone Polygon. PostGIS availability has now been confirmed for the target PostgreSQL database. `fields.boundary` and `zones.boundary` are therefore the spatial source of truth and use `geometry(Polygon,4326)`, with GiST indexes and `ST_IsValid` constraints. Npgsql NetTopologySuite performs the EF conversion while the Domain remains free of persistence-framework references.

Field requests use `boundaryGeoJson`; Zone requests preserve the source name `polygonGeoJson`. Both accept and return a GeoJSON object with `type: "Polygon"`, so map clients do not change. Each ring must contain at least four longitude/latitude positions, coordinates must be in valid ranges, the first and last position must match, and the resulting polygon must be topologically valid. Coordinate order is longitude then latitude and SRID is 4326.

Migration `UsePostGisBoundaries` renames the previous JSONB columns to `boundary_geo_json_legacy`, creates the PostGIS columns, and backfills them with `ST_GeomFromGeoJSON`. The legacy columns are deliberately retained for rollback and are no longer read or written by the application. Removing them is a separate, reviewed migration after production verification. Geodesic area reconciliation, containment and overlap policy remain explicit follow-up rules rather than silently changing the existing area contract.

## Area and archive rules

- Farm area is greater than zero and at most 1,000,000 square metres. The total active Field area cannot exceed its Farm.
- A Farm area cannot be reduced below the total active Field area.
- New Field available area equals its area. An archived Field no longer consumes Farm capacity.
- A Zone area cannot exceed its Field available area. Creating, resizing or archiving a Zone updates available area transactionally.
- Field area is immutable after any active Zone is allocated. Field boundary, name and soil type remain editable.
- Zone status is `Inactive`, `Operating` or `Archived`. New Zones are `Inactive`; `Archived` is reached only through DELETE. An Operating Zone cannot be resized or have its boundary changed.
- DELETE archives records. Farm and Field archive are rejected while a descendant Zone is Operating. Zone archive preserves the row and returns its area to the Field.
- Checks for InProgress seasons and assigned devices will be added when those entities are introduced; this slice does not fabricate those records or policies.

## API differences from the source proposal

- UUIDs are used instead of example IDs such as `f-202`.
- Field create and update accept `boundaryGeoJson` to satisfy Flow 1. Latitude and longitude remain optional map-centre metadata.
- Device counts, crops and active-season fields are omitted until those slices exist; counts returned by this slice cover only persisted Farm, Field and Zone data.
- Pagination is not introduced in this slice; list responses return the current Tenant's complete active hierarchy.
