# SmartFarm Crop Growth and Planting Season Contract v1

This contract resolves gaps in Flow 1 and endpoints #33-#45 of `reference/API .docx`.

## Catalog ownership and visibility

System Crops, Varieties and Growth Profiles have `tenantId = null` and are readable by every authenticated role. Tenant-owned records carry the FarmOwner's Tenant from the JWT and are visible only to that Tenant. Client requests never supply a Tenant ID.

FarmOwner creates Tenant-owned Crop and Variety records. Names are compared case-insensitively within the visible catalog: a Tenant cannot create a name that duplicates a visible system record or another record in that Tenant. Records in unrelated Tenants are not exposed.

## Profile creation and customization

Endpoint #38 accepts either:

- `sourceProfileId` referencing a visible system profile, which clones its stages and environmental requirements into a new Tenant-owned profile; or
- an inline `stages` collection for a new Tenant-owned profile.

This extension is required because the source has no endpoint that creates Growth Stages. Stage order and names must be unique within a profile and order starts at 1 without gaps. Every stage must define at least `TEMPERATURE`, `SOIL_MOISTURE`, `AIR_HUMIDITY` and `PH`; `LIGHT_INTENSITY` and `EC` are also supported. Each range satisfies `minValue <= targetValue <= maxValue`.

Endpoint #40 never mutates a system profile. When a system stage is targeted, the service clones the complete profile for the current Tenant, applies the requirements to the corresponding cloned stage and returns both the effective profile and stage IDs. A Tenant stage can be updated only by its own Tenant.

Only one default profile is allowed for each Tenant/Crop/Variety scope. System defaults remain unchanged when a Tenant chooses its own default.

## Planting season lifecycle

Creating a season through #42 starts it immediately as `InProgress`, chooses the stage with `stageOrder = 1`, and copies that stage's requirements into `season_applied_requirements`. Crop, Variety and Profile must form one consistent visible chain.

A filtered unique PostgreSQL index enforces at most one `InProgress` season per Zone. Stage transition #44 accepts only a stage from the season's profile, replaces the applied requirements in the same transaction and appends a `season_stage_transitions` audit row. The alert-rule synchronization count remains zero until the Alert Rule slice exists; the effective thresholds are nevertheless updated in `season_applied_requirements`.

Closing #45 changes an `InProgress` season to `Completed`, records the actual end date and optional yield, and preserves all stage-transition and applied-threshold history. Cancel is deferred because the source does not define its command contract.

All Zone and Season endpoints resolve Zone → Field → Farm → Tenant. FarmOwner may write. Farmer may read only a Zone explicitly assigned through `user_zone_accesses`.
