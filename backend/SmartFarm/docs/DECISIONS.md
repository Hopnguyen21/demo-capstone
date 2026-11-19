# Decisions to settle against the two source documents

1. **Account lifecycle — settled for Auth v1.** `POST /api/v1/auth/register` lets an unauthenticated person create only a `FarmOwner` or `Farmer` account. The account initially has no Tenant or Farm. API #13 is changed to an authenticated `FarmOwner` operation: it creates the Owner's Tenant during the first-Farm setup wizard and attaches that existing Owner account in one transaction. It does not create another Owner and is not PlatformAdmin-only. Tenant activation is immediate in v1; an approval workflow may be versioned later. API #17 remains the following wizard step and must use the Tenant from authenticated server context.
2. **Farmer invitation — settled for Auth v1.** API #10 looks up an existing active, unassigned `Farmer` account by email and assigns it to exactly one Farm in the Owner's Tenant. It never creates an account, generates a temporary password, accepts `assignedFarmIds`, or returns password material. The Owner assigns one or more Zones in that same Farm through the separate Zone-access endpoint. A Farmer already assigned to any Farm causes `409 Conflict`.
3. **Role labels.** Source diagrams say Farmer/Farm Manager, and API occasionally includes FarmWorker. Canonical roles: PlatformAdmin, PlatformTechnician, FarmOwner, Farmer. A Farmer may manually control only when explicitly allowed (`can_control`) and assigned to the zone; API #80 currently says FarmOwner only.
4. **Finance/service scope.** API has cash-flow report (#102) and hot-swap (#95), but no explicit finance transaction CRUD, technician survey/deployment request workflow, maintenance request, or replacement work order. These are in agreed SmartFarm scope; define APIs and schema separately, then renumber/version deliberately.
5. **Data stack.** API proposes PostgreSQL 16 + PostGIS, TimescaleDB, pgvector, Redis, MQTT, SignalR, FCM and Gemini. Compose uses base PostgreSQL for local bootstrap only. Verify extension availability and storage/retention plan before implementing dependent features.
6. **Version/spec consistency.** Cover says 103 endpoints; overview and index heading say 102, but index enumerates #1–#103. Use 103. API examples show IDs such as `f-202` while validations demand UUID: use UUID in implementation and update examples/contracts. Resolve response field casing and pagination consistently.
7. **IoT trust.** Source describes LoRa gateway → MQTT telemetry and commands but not a standalone ingest endpoint; design authenticated MQTT adapter, normalized payload, replay prevention, ACK/timeout policy and firmware contract before implementing control.
8. **Farm creation wizard.** MainFlow includes farm location/default settings/review/submit; API #17 creates Farm and #22 submits it. Map wizard steps to draft data, validation and status transitions before building UI.

Avoid guessing these contracts within endpoint implementations. Record each settled choice here and update `docs/API_CATALOG.md` or a versioned API contract.

9. **Eight-flow coverage.** `SmartFarm_Flow.docx` adds device estimation, Owner confirmation, Technician survey/adjustment, deployment outcome, task reassignment, expense/revenue entry and maintenance service lifecycle. The 103-endpoint index does not define complete request/response contracts for all of these. Define versioned APIs before coding those gaps.
10. **Role vocabulary in Flow 6/8.** The flow says Manager/Employee; map to FarmOwner/Farmer. For device fault reporting by Farmer, define zone permission and whether it creates a draft report or a Service Request requiring Owner approval.

11. **Platform staff lifecycle — settled for Auth v1.** Platform staff never receive `tenantId` or `farmId`. `PlatformAdmin` manages `PlatformTechnician` accounts through platform-only endpoints. Public registration cannot create either platform role. The initial PlatformAdmin is provisioned operationally; no default production credential is seeded.
12. **JWT and session contract — settled for Auth v1.** Access tokens contain `sub`, `role`, `jti`, `iat` and `exp`; `tenant_id` and `farm_id` are emitted only when assigned. Refresh tokens are opaque random values, stored only as SHA-256 hashes, rotated on every refresh and revoked on logout. A DB-backed session check invalidates the matching access-token `jti` after logout or rotation. Signing keys come only from configuration/environment.
13. **Auth v1 contract authority.** `docs/AUTH_CONTRACT_V1.md` overrides conflicting Auth/User/Tenant examples in the source DOCX for this phase. Endpoint numbers #1–#3, #6–#7 and #10–#15 retain their catalog identity. New self-registration, Zone-access and Technician-management routes are versioned additions and do not renumber the 103 source endpoints.
14. **Farm boundary storage — settled for Farm v1.** Field and Zone boundaries are validated GeoJSON Polygons stored as PostgreSQL `jsonb`; base PostgreSQL is sufficient and no spatial extension is assumed. This phase validates shape and coordinate ranges but does not claim geometric containment or overlap enforcement. `docs/FARM_STRUCTURE_CONTRACT_V1.md` defines the migration path to PostGIS and overrides conflicting Farm/Field/Zone examples for this slice.
15. **Growth profile customization — settled for Growth v1.** System profiles are immutable. An Owner customization clones the whole profile, its ordered stages and requirements into the JWT Tenant before applying changes. `POST /growth-profiles` accepts inline stages or `sourceProfileId` because the source defines no stage-creation endpoint. Active season thresholds are materialized in `season_applied_requirements` and replaced transactionally on stage transition. See `docs/CROP_GROWTH_CONTRACT_V1.md`.
16. **IoT planning and deployment — settled for IoT v1.** Flow 1 steps 14–30 are modeled as a stateful Deployment Request with immutable decision history. Device requirements come from the active season's applied stage thresholds; recommendation quantity uses model coverage and Zone area. PlatformTechnician operations require an accepted request rather than trusting a client-supplied Farm ID. Connection checks store observed results and do not fabricate MQTT success. A failed deployment creates an explicit `MaintenanceRequired` state and open service-request handoff. See `docs/IOT_DEPLOYMENT_CONTRACT_V1.md`.
17. **Telemetry trust and alert anti-flap — settled for Telemetry v1.** MQTT transport identity selects the Gateway; payload data cannot select Tenant or Gateway. Ingestion is idempotent by Device/message/parameter and Device/timestamp/parameter. Current season applied requirements drive stage-aware evaluation. Two consecutive violations are required, normal readings reset state, open alerts and cooldown suppress repeats. Alert acknowledgement and resolution are separate append-only history events. Historical data does not imply a Device is currently online. See `docs/TELEMETRY_ALERT_CONTRACT_V1.md`.
18. **Asynchronous actuator control — settled for Control v1.** HTTP acceptance, broker publication and physical execution are distinct. Commands use `Pending → Sent → Acknowledged/Failed/TimedOut/Cancelled`; only authenticated device feedback proves execution or cancellation. Manual commands preempt automation through an acknowledged emergency-stop handshake, all irrigation is capped at 30 minutes, and server-side interlock/rain/freshness checks run before dispatch. Five-field cron expressions are interpreted in the Farm timezone because the source examples conflict with its Quartz label. See `docs/CONTROL_CONTRACT_V1.md`.
19. **AI advice and Owner approval — settled for AI v1.** AI is isolated behind `IAiAdvisoryProvider` and cannot actuate or mutate automation. Server-built Farm/Zone/season/stage/telemetry/weather context is mandatory for actionable advice. Missing data, provider failure or confidence below the configured threshold produces an explicit limited, non-actionable recommendation. Only a FarmOwner may accept a current valid recommendation; acceptance invokes Phase 7 control and records both `recommendation_id` and source `AI_APPROVED`. Reject, ignore and request-more-analysis are retained as append-only decisions. History deletion is a UI hide, not audit deletion. See `docs/AI_RECOMMENDATION_CONTRACT_V1.md`.
# 20. Inventory movements and task transitions are explicit (2026-09-25)

API #97 and #101 were broader than Flow 5–6. The v1 contract in
`INVENTORY_TASK_CONTRACT_V1.md` makes stock receipts separate from material creation
and makes task updates explicit state-machine actions. Material names are unique per
Farm after normalization. Stock changes and task transitions are append-only audit
records. Flow roles `Manager`/`Employee` are interpreted as `FarmOwner`/`Farmer`.

# 21. Finance and device service lifecycle are explicit (2026-09-25)

The source exposes only hot-swap #95 and cash-flow report #102. The v1 contract in
`FINANCE_SERVICE_CONTRACT_V1.md` adds auditable finance CRUD and a Service Request state machine.
Flow 7 expense `Employee` is named `Farmer`; no role is added. PlatformAdmin assigns an active
PlatformTechnician, and only that Technician may inspect, diagnose, work, replace, test, and close.
A request cannot close until the latest connection test for the current Device succeeds.

# 22. Reports expose sourced values and measurement gaps (2026-09-25)

Reporting v1 reads only implemented transactional tables and authenticated Tenant/Farm scope.
Water and electricity include only acknowledged TurnOn commands. Water uses actuator flow rate;
electricity uses rated power. Missing ratings are counted as unmeasured rather than replaced by
assumed constants. Formulas and source tables are normative in `REPORTING_CONTRACT_V1.md`.

# 23. Gemini is advisory and weather remains an independent source (2026-09-25)

The production AI adapter uses Google Gemini `gemini-2.5-flash` through `IAiAdvisoryProvider`
with structured JSON output. Secrets are loaded from environment/User Secrets and never committed.
The model sees only server-built Tenant/Zone context and cannot call MQTT or mutate state. Proposed
actuator IDs and durations are checked again against current database state. Open-Meteo provides
coordinate-based weather independently; provider failure yields a non-actionable limited result.

# 24. Field and Zone boundaries use PostGIS (2026-09-25)

PostGIS availability was confirmed for the target PostgreSQL database. Field and Zone boundaries
are stored as `geometry(Polygon,4326)` with GiST indexes and `ST_IsValid` constraints. The HTTP
contract remains GeoJSON, and an Infrastructure value converter keeps NetTopologySuite out of the
Domain project. Migration `UsePostGisBoundaries` backfills the new spatial columns from the former
JSONB values and retains renamed legacy columns for rollback until a later cleanup migration.

# 25. Agriculture documents require source review before AI use (2026-10-29)

Uploaded files are retained in PostgreSQL alongside extracted text so reviewers can download
the byte-for-byte original while correcting OCR. New uploads and content replacements enter
`PendingReview`; only `Approved` documents are embedded, returned by RAG, or accepted as a
Growth Profile source. Existing rows migrate as `Approved` to preserve current behavior. The
review endpoint saves corrected text/chunks and the decision together. This is a human source
comparison workflow, not an automated claim that OCR or VietGAP compliance is correct.

# 26. Upload-time sufficiency check, typed requirements and cited extraction (2026-10-29)

Supersedes the "existing rows migrate as `Approved`" part of decision 25: migration
`ResetUnreviewedDocumentApprovals` returns uploaded rows that no reviewer ever approved
(`reviewed_at_utc IS NULL`, `file_type <> 'seed'`) to `PendingReview`. Seed rows stay `Approved`.

Uploads now pass a sufficiency check before anything is stored: a fixed checklist, then a Gemini
assessment. Both must pass; an insufficient document returns `422` with the missing items and an
unavailable AI returns `503`. Neither stores the document. A document that passes is still saved
as `PendingReview`. The AI only judges that information is *present*, and a human reviewer
confirms it is *correct* before RAG use (SRS 4.2.4 "curated and traceable").

Required sections depend on the declared document type, because the SDD and the AI/RAG test plan
expect thematic documents (irrigation, IPM, nitrate control) in the knowledge base:
`OfficialStandard` needs a standard code and all seven VietGAP core sections; `TechnicalGuide`
needs a traceable publisher plus soil, fertiliser, pest and harvest content; `Thematic` needs a
publisher plus the section matching its `Category`.

At upload the AI also fills a fixed 26-field template plus growth stages. A value is kept only
when its quotation is found verbatim in the stored text, and numbers must appear in that quotation.
The page number is computed from `[TRANG n]` markers rather than taken from the AI. Fields without
a matching quotation are shown as absent from the source; the system does not fill them from model
knowledge (SRS BR-12).

# 27. Documents are independent RAG sources; Growth Profile is built per crop (2026-10-29)

Supersedes the upload-time sufficiency gate of decision 26, which was already removed from the
upload path. A document no longer has to contain every VietGAP section. Each document is an
independent source with metadata: crops, document type, `topics` (several allowed), publisher,
version and a content hash. Each chunk records page, section and topic. Review requires only a
traceable source, a standard code for official standards, and content for the topics the document
declares.

Retrieval combines passages from several approved documents. It boosts the question's topics,
caps each document at two passages, and cites document, page and section. Approving a document
with the same title and publisher as an older approved one marks the older one `Superseded`, so
outdated figures leave RAG. Identical content in the same scope is rejected with `409`.

The Growth Profile draft can gather all approved documents of a crop instead of exactly one, so
documents covering only harvest, pests or irrigation each contribute. The existing generator still
requires every stage, duration and threshold to quote the source verbatim. Insufficient cited data
returns `409` rather than template values (SRS BR-12), and each quotation is attributed to its
source document.

Cited extraction moved to the background worker so uploads return quickly. Truncated Gemini
replies are retried. The shared `Gemini:FallbackModels` list replaces per-call model lists after the
configured `gemini-2.5-flash` began returning 404.

# 28. Document ingestion does not use AI for OCR or Growth Profile generation (2026-10-30)

Supersedes the Gemini OCR and document-to-Growth-Profile behavior described in older
implementation notes. Upload/update reads text only through local PDF/DOCX/TXT parsers. A
scanned PDF without a searchable text layer is rejected with instructions to OCR it outside
SmartFarm. The `draft-growth-profile` endpoint, its web/mobile client methods, and the VietGAP page's
document-to-Growth-Profile builder are removed. Growth Profiles remain managed through their
separate crop-growth workflows. Approved sources remain available to RAG-based AI advisory; the separate agricultural-topic
check remains advisory and does not claim technical or VietGAP compliance.


## AI advisory: crop provenance, season facts and knowledge crop (2026-10-31)

- The operational crop/variety (`AiZoneContext.CropName`, `VarietyName`, `CropSource = "zone"`) is the Zone's own `CropId`/`CropVarietyId` (see the Zone crop decision below). A season is used for age, stage, plan and thresholds only when its InProgress crop matches the Zone crop; otherwise `SeasonCropMismatch = true`, `SeasonCropName` names the season crop, and no stage, age or threshold of that season is used or proposed. `CropHint` is only the crop of a Planned season, labelled as planned.
- `AiSeasonFacts` is computed by the backend and is present whenever an `InProgress` season exists, even if the Growth Profile or stage is missing or belongs to another crop. Elapsed and remaining days use the Farm-local date (`Farm.TimeZone`), not the UTC date. `ExpectedEndDate` is the expected end of the season, never a harvest date (the schema stores no harvest date); stage `DurationDays` and the Profile total are planned durations. A new `harvest` topic is answered deterministically from these facts.
- Knowledge retrieval uses `KnowledgeCrop`: the crop named in the question (except for irrigation/control questions, which always follow the Zone), then the Zone crop, then the hint. It only selects which approved documents are searched; telemetry, stage and thresholds stay the Zone's. Documents have no Zone relation: scope is Approved + public-or-own-tenant + crop scope.
- Multi-intent questions keep the data parts: when the knowledge part has no approved passage, or the weather is unavailable, the Zone-data answer is still returned with the gap named. The intent classifier only chooses topics; if it fails the full context goes to the provider.

## Zone current crop is independent of planting seasons (2026-10-31)

- `Zone.CropId`/`CropVarietyId` (nullable FKs to `crops`/`crop_varieties`, `ON DELETE RESTRICT`) hold the crop currently grown. A Zone without a crop is valid and is shown as "Chưa gán cây"; nothing falls back to a default, the Zone name, notes, contracts, or the latest season. `ZoneView` exposes `cropId`, `varietyId`, `cropName`, `varietyName`, `currentCrop` (Zone only), `currentStage` (only when the InProgress season has the same crop), `seasonStatus` (`None`, `InProgress`, `Mismatch`, `PlannedOnly`), `seasonName`, `seasonCropName` and `plannedCrop`.
- `POST /fields/{id}/zones` and `PUT /zones/{id}` accept `cropId`/`varietyId`; the crop must be a system crop or one of the caller's Tenant, the variety must belong to that crop. On update, omitting `cropId` keeps the crop, `clearCrop: true` removes it. Changing or clearing the crop while an InProgress season has another crop returns 409.
- `POST /zones/{id}/planting-seasons` takes `setZoneCrop`. If the Zone already has another crop the request is rejected with 409 unless `setZoneCrop` is true (explicit Owner confirmation, applied in the same transaction as the season). A Zone with no crop is only assigned the season crop when `setZoneCrop` is true; otherwise the season is created and the Zone reports `Mismatch` until the Owner assigns a crop. The service never synchronises crops silently. Planned seasons never touch the Zone crop. A season cannot start in the future.
- Migration `AddZoneCurrentCrop` backfills a Zone only when it has exactly one InProgress season; Completed, Cancelled and Planned seasons, Zone names, notes and contracts are never used. Every other Zone stays NULL and the Owner must pick the crop. The development-only `DataIntegrityHealer` no longer creates seasons or guesses crops.

- Bulk apply (2026-10-31): `POST /api/v1/farming-seasons/{id}/planting-seasons/bulk` (FarmOwner) creates one PlantingSeason per Zone under one FarmingSeason (max 50 Zones, per-Zone dates, per-Zone `setZoneCrop` confirmation). `dryRun` only validates; without `skipInvalid` any invalid Zone means nothing is created, with it only valid Zones are created, always in one serializable transaction that re-validates. A Zone has at most one season per FarmingSeason (also enforced by the single-Zone create, 409), no second InProgress season, and no Planned season of another FarmingSeason. Zones of other tenants get the same "not found" problem as unknown ones. Harvest data stays on each Zone's PlantingSeason (`ActualEndDate`, `ActualYieldKg`); no new table.

- Rule change (2026-10-31): the Zone crop is assigned only by creating a planting season (single or bulk). `POST /fields/{id}/zones` and `PUT /zones/{id}` no longer accept `cropId`/`varietyId` (ignored); `PUT` keeps `clearCrop` (409 while an InProgress season exists). A Zone with no crop gets the season crop automatically; a Zone with another crop needs `setZoneCrop` (per Zone in bulk). The web Zone form no longer has a crop selector.

- Growth profile ownership (2026-10-31): FarmOwner may only copy a system profile (`POST /growth-profiles` with `sourceProfileId`; building one from scratch is refused) and edit that tenant copy (`PUT /growth-profiles/{id}`, `PUT /growth-stages/{id}/requirements`); system profiles stay editable by PlatformAdmin only (an Owner edit of a system stage lands on the tenant copy). Edits never change the thresholds already snapshotted on running seasons; they apply to seasons created afterwards. The season form labels profiles as system or farm-owned. Web: managed inside the Zone detail panel (no separate menu page).

## AI advisory performance (2026-11-01)

- Each answer logs `[AI timing]` per stage. The question intent is cached in memory for 6 hours by normalized question text (it depends only on the text, not on Zone or Tenant) and the query embedding likewise; answers themselves are never cached because they depend on live data.
- A question that is only a greeting or out of scope gets a fixed answer without calling the model. The optional overall sensor comment is limited to 4 seconds and the readings are returned without it. After a failed query embedding, retrieval uses keyword search for 5 minutes without calling the API.

## Zone ↔ Growth Profile attached directly; profile irrigation schedule (2026-11-10)

- **Zone.GrowthProfileId** (nullable FK → `growth_profiles`, RESTRICT, indexed) stores the profile currently applied to a Zone. Setting, changing or clearing it (`POST /fields/{id}/zones` and `PUT /zones/{id}` with `growthProfileId` / `clearGrowthProfile`) never creates or changes a `PlantingSeason`; a running season keeps its own `GrowthProfileId` (history is untouched). A profile defines the crop: the Zone's `CropId`/`CropVarietyId` are taken from it, a mismatching `cropId`/`varietyId` is a 400, and switching to a profile of another crop is a 409 while an `InProgress` season of a different crop exists. A profile is visible if it is a system profile or a copy of the caller's Tenant; another Tenant's profile is treated as not existing (400). `ClearCrop` also clears the profile.
- **Backfill/compatibility.** The migration fills `zones.growth_profile_id` only from the Zone's `InProgress` (else latest `Planned`) season when crop and variety match the profile and the profile is a system or same-Tenant profile; everything else stays NULL ("no profile yet") instead of guessing. Down drops the column, index, FK and the schedule table.
- **Irrigation schedule belongs to the profile, per stage** (`growth_stage_irrigation_sessions`): title, `start_time` (local Farm time), `duration_seconds` 1..1800, `enabled`, optional `method` and `water_per_plant_ml` (informational), unique `(growth_stage_id, sort_order)`, repeats DAILY for every day of the stage. `GET /growth-profiles/{id}/irrigation-schedule` (source per stage: `Profile` | `Crop` read-only sample | `None`; `isEditable`), `PUT` replaces the sessions of the listed stages (FarmOwner on own copy only; system profile and other Tenants → 404). `Crop.CalendarIrrigationPlan` is never written by profile edits. Cloning a system profile copies its sessions, or materialises the crop sample into every stage when the source has none.
- **Sync from the Zone's profile**: `POST /zones/{id}/schedules/sync-from-profile` (FarmOwner) builds `ControlSchedule`s from the profile stage (explicit stage, else the current stage of an `InProgress` season using the same profile, else the first stage); the actuator must belong to the Zone; sessions fall back to the crop sample only when the stage has none, and the response says which source was used. `sync-from-crop` stays for the existing web client.
- **Per-day irrigation calendar belongs to the planting season (Zone + season)** (`season_irrigation_plans` 1 row/season, `season_irrigation_days`, `season_irrigation_sessions`; migration `AddSeasonIrrigationCalendar`). Only edited days (overrides) are stored, keyed by season day number (1 = start date); other days use the profile stage schedule (template, never modified here). `GET` returns every day with `source` (`Override`|`Profile`|`Crop`|`None`), `status` (`NoOverrides`|`Current`|`Stale`), `staleReasons`, `updatedAtUtc/updatedByUserId`; `PUT` upserts listed days (1..season length, ≤8 sessions, HH:mm, 1..1800 s, no duplicate times; an empty session list = deliberately no irrigation); `DELETE` restores the whole season or one day. FarmOwner only writes, only for Planned/InProgress seasons; Farmers read with zone access; other Tenants/zones → 404. When the season changes start date, length or profile the overrides are KEPT and flagged `Stale` (days beyond the new end are returned with `outOfRange` and ignored by sync) — the user restores explicitly. `sync-from-profile` (no explicit stage) uses today's override of the InProgress season when present (`source: SeasonOverride`, with `seasonId`/`dayNumber`), otherwise the profile stage schedule, then the crop sample; it only replaces `[AutoSync]` ControlSchedules. The device schedule stays daily-cron, so it repeats until the next sync. The web FE still keeps its own per-day schedule in localStorage; migrating it to this API is pending.

## Platform technician reads only assigned farms (2026-11-12)

- **Scope.** A `PlatformTechnician` is not a member of any tenant, so farm structure reads (`GET /farms`, `/farms/{id}`, `/farms/{id}/structure`, `/farms/{id}/fields`, `/fields`, `/fields/{id}`, `/fields/{id}/zones`, `/zones`, `/zones/{id}`) are limited to farms that have an active request assigned to that technician: a deployment request in `Accepted`, `Surveyed`, `PlanConfirmed`, `Installing` or `MaintenanceRequired` with `TechnicianUserId` = caller, or a service request with `AssignedTechnicianId` = caller that is not `Resolved`/`Closed`. A `Submitted` (unassigned) or `Completed` request grants nothing; the facts needed to decide whether to accept a request are already in the request detail (`context`).
- **Outside the scope the farm does not exist.** Fields, zones and farms of other tenants answer `404` (not `403`) so existence is not disclosed. `PlatformAdmin` still reads every farm; `FarmOwner`/`Farmer` stay limited to their tenant.
- **Why.** Before this the list/read paths treated platform staff as unrestricted, so any technician could enumerate every tenant farm without an assigned request. Implemented in `FarmStructureService` (`technicianFarmScope`); covered by `TechnicianFarmScopeTests`.
- **Not changed here.** Other technician-allowed endpoints (zone contracts, bills, stock-outs, tasks) have their own scoping rules and still need to be reviewed against the same principle.

## Business parameters live in `platform_settings` (2026-11-13)

- **Rain guard %, deposit %, repeat/renewal discount %, AI minimum confidence and telemetry freshness** are read from `platform_settings` through `PlatformSettingsStore` at the moment they are used. An Admin change applies on the next request, without restart.
- **Defaults and ranges** are defined once in `PlatformSettingsStore.Definitions`. A missing, non-numeric or out-of-range row falls back to the default (AI settings fall back to the `Ai` section of appsettings). `GetSettingsAsync` creates the missing rows so the Admin screen always lists them.
- **Validation and audit.** `UpdateSettingsAsync` rejects out-of-range values for known keys (`RequestValidationException`) and writes one `PLATFORM_SETTING_UPDATED` audit record per changed key (secret values are not logged).
- **Service Request cancel follows the deployment rule.** Cancelling an installation Service Request cancels the linked deployment only before installation starts and before the contract is signed or the deposit paid (409 otherwise). Cancelling a maintenance Service Request never changes a deployment.
- Remaining constants are listed in `CONFIGURATION_MATRIX.md`.

## Final acceptance waits for `Completed`; deposit changes apply only to unsigned quotations; public business parameters (2026-11-14)

- **Final acceptance requires the linked deployment to be `Completed`.** Report 3 FR-14, Report 4 Fig 3.24 and BM04 WF-01 say "Installing or Completed". Accepting during `Installing` closes the service request and finalises the quotation while the Technician can no longer place nodes or complete, so the deployment would stay `Installing` forever. The owner decision is that the Owner accepts only after the Technician completes the installation. The reports must be changed to `Completed`.
- **Deposit percentage applies only until the Owner has viewed the quotation.** While no Owner has opened a `SentToOwner` quotation, it is shown with the current `contract.deposit_percent`. The first Owner `GET .../quotation` fixes the displayed amounts (stored on the quotation; the view is recorded as an `audit_logs` row `QUOTATION_VIEWED_BY_OWNER`, so no schema change). From then on, and after signing, Admin changes never alter it. Signing without having viewed first recomputes with the current percentage. Signed (`SignedByOwner`), completed quotations and created Zone contracts keep the stored amounts. `sign-contract-deposit` takes an optional `expectedDepositAmount` and answers 409 if it no longer matches, so the Owner never pays an amount other than the one shown.
- **`GET /api/v1/platform/business-parameters` is public** (no sign-in). It returns only the deposit %, rain guard %, repeat and renewal discount %, because the landing pages state the deposit rate before sign-in. Secret settings are never returned. (Catalog: extension row below.)
- **`ServiceRequestView` exposes the four contract/payment milestone flags** (`isContractSigned`, `isDepositPaid`, `isAcceptanceSigned`, `isFullyPaid`).

## Stock-out moves devices to the technician; node provisioning draws from that stock; installation completion carries acceptance notes (2026-11-16)

- **Completing a stock-out transfers hardware from the main warehouse to the technician who created the voucher.** Serial-tracked Gateway/Node rows change owner (`InTechnicianStock`); quantity rows are split (main row decremented, the technician's row of the same Code created or increased). Only `InWarehouse` rows without an assignee can be issued; a voucher created by a non-technician cannot move hardware; `Cancelled` can no longer be completed.
- **`POST /devices/provision` draws from the calling technician's own stock** when a node carries `hardwareItemId` (409 if the item is not in that technician's `InTechnicianStock` or too few remain). Unique rows become `Deployed`; quantity rows are decremented; re-provisioning an already owned address never deducts twice. `POST .../complete` marks only unique or emptied rows `Deployed`.
- **`POST /platform/deployment-requests/{id}/complete` accepts an optional `{ "notes": "…" }`** (technician's acceptance report note, max 4000 chars). It is stored in the `DeploymentCompleted` entry of `decisionHistory`, which the Owner reads before signing final acceptance.
- **The stock-out voucher is no longer a mobile gate for placing nodes.** Placing nodes needs only the signed contract and paid deposit.
- **Returning hardware goes back to the main warehouse without losing stock.** `POST /platform/hardware-items/{id}/return` adds a technician's quantity row back onto the main-warehouse row of the same Code (the technician row drops to 0 and is kept); serial-tracked Gateway/Node rows become `InWarehouse` again; a `Deployed` item cannot be returned (409). `POST /platform/hardware-items/{id}/assign` stays Admin-only: a technician receives stock through a stock-out voucher (or an Admin-approved allocation request), never by self-assigning.
- **Stock follow-ups (2026-11-17).** Provisioning runs in one Serializable transaction, and an existing node that is newly linked to a stock item (re-attached or re-linked) is deducted like a new node; a legacy link to an item no longer in the technician's stock is only recorded. Two lines of the same non-serial item in one voucher merge into one technician row. A serial-tracked (Gateway/Node) row must have stock exactly 1 to be issued (409 otherwise). Returning a `Faulty`/`Maintenance` item unassigns it but keeps that status, so it never looks like available warehouse stock. The deposit auto-voucher (`StockOutAutomationHelper`) is removed.
- **Stock-out permissions (2026-11-17).** Completing a stock-out transfers hardware to its creator, so only a PlatformAdmin may approve or complete a voucher (a technician gets 403). A technician sees and changes only vouchers they created (others return 404) and may only submit (`Pending`) or cancel them. The nodes' hardware role must match the node type being provisioned (409 otherwise).

## Thông báo của luồng lắp đặt và phiếu xuất kho (2026-11-17)
- `NotificationType` thêm `Service` (luồng lắp đặt) và `StockOut` (phiếu xuất kho); kiểu lưu chuỗi nên không cần migration.
- `FlowNotifications` (Infrastructure/Notifications) chỉ THÊM `Notification` vào DbContext, lưu cùng lượt với thay đổi nghiệp vụ. `ReferenceId` = mã phiếu dịch vụ (Service) hoặc mã phiếu xuất kho (StockOut).
- Người nhận: phiếu Pending → mọi Admin hoạt động; phiếu Approved/Completed/Cancelled → người tạo phiếu (không tự báo cho chính người thao tác); giao/giao lại KTV → KTV; gửi báo giá/hợp đồng → Owner (người tạo yêu cầu, không có thì FarmOwner của tenant); ký hợp đồng + cọc và ký nghiệm thu → KTV; KTV hoàn tất lắp đặt → Owner (ReferenceId là phiếu dịch vụ liên kết, không có thì mã đợt triển khai).
- Mobile: chạm thông báo `Service`/`StockOut` mở đúng màn (`features/tasks/notification_navigation.dart`); KTV xem thông báo ở Hồ sơ → "Thông báo" vì tab Thông báo của màn Cảnh báo là của Owner/Farmer.
- Chống trùng thông báo cảnh báo: `CreateNotificationCommand.SuppressIfUnread` — còn thông báo CHƯA ĐỌC cùng người, loại và ReferenceId thì không tạo thêm; đã đọc hoặc đã xóa thì lần sau vẫn báo lại (sự cố thiết bị dùng ReferenceId = mã thiết bị nên mỗi đợt sự cố mới vẫn được báo). Dùng cho cảnh báo môi trường và sự cố thiết bị.
- Chưa làm: kênh push.

## Chống nhầm Node cảm biến / điều khiển khi gắn Node (2026-11-17)
- `HardwareStockRules.EffectiveNodeType`: vai trò Admin gán (SensorNode/ActuatorNode) nếu có, chưa gán thì suy từ chủng loại kho (VALVE/PUMP/RELAY/ACTUATOR → điều khiển, SENSOR → cảm biến). `RoleMatches` chặn khi loại hàng khác loại Node được gắn; Gateway/Camera/Peripheral/InstallKit không bao giờ làm Node. Hàng không xác định được loại vẫn không bị chặn (dữ liệu cũ).
- `ProvisionDevicesAsync` thêm: `deviceModelId` phải cùng loại với `deviceType` của Node; gắn lại một địa chỉ đã có với loại khác → 409.
- Mobile (`node_provisioning_flow.dart`): `inferNodeType` cùng quy tắc; hàng suy ra loại khác dòng hợp đồng thì không chọn được. Danh sách vẫn chỉ liệt kê hàng có vai trò Node hoặc chủng loại có chữ NODE.
- Mobile chấm Node: hàng chưa có loại Node (Admin chưa gán `EstimateRole`, chủng loại không suy ra được) phải được KTV xác nhận rõ "đây là Node cảm biến/điều khiển" trước khi cấp phát; `_planItemFor` không còn lấy mẫu thiết bị khác loại làm mặc định. `ValveNode`/`PumpNode` được coi là Node điều khiển.
- Hợp đồng là nguồn xác định loại khi chấm Node: dòng hợp đồng ghi mã hàng (`HardwareItemCode`, trùng `Code` hàng kho) và loại (SENSOR_NODE/ACTUATOR_NODE). Mobile coi hàng kho cùng mã với dòng đang chấm là "đúng thiết bị trong hợp đồng" (xếp đầu), hàng chưa gán vai trò nhưng mã nằm trong hợp đồng thì lấy loại theo hợp đồng (khác loại dòng đang chấm thì khóa), chỉ hàng KHÔNG rõ loại bằng cả hai nguồn mới bắt xác nhận.
- Cập nhật (thay các dòng "xác nhận loại" ở trên): bảng cấp phát Node KHÔNG hỏi xác nhận và không ghi chú cảnh báo; tự gợi ý theo hợp đồng: hàng đúng mã dòng đang chấm lên đầu, rồi hàng cùng loại, rồi hàng chưa rõ loại; hàng đã biết là khác loại (theo vai trò/chủng loại kho hoặc mã trong hợp đồng) bị ẩn. Backend vẫn chặn 409 khi lệch loại.
- Web Admin (Kho thiết bị, `DevicesPage`): form Thêm và Sửa có ô "Vai trò Node" (Chưa gán / Node cảm biến / Node điều khiển / Van / Bơm / Gateway / Bộ phụ kiện) gửi `estimateRole`; bảng hiện "Vai trò: …" (màu cam khi chưa gán). Sửa với giá trị rỗng sẽ xóa vai trò; sửa hàng loạt đơn giá không gửi nên giữ nguyên.

## Gói dịch vụ trong hợp đồng lắp đặt (2026-11-17)
- Mobile (KTV, bảng báo giá `quotation_editor.dart`): mục "Gói dịch vụ đi kèm" liệt kê gói chuẩn đang bán (`GET /contract-packages?activeOnly=true&isCustom=false`, Admin/KTV đọc được); tích gói = thêm một dòng báo giá category `SERVICE_PACKAGE`, mã `PKG-<TOÀN BỘ mã gói, bỏ dấu gạch, in hoa>` (cắt 8 ký tự đầu từng làm mọi gói có id `a0000001-…` trùng mã nên tích một gói là tích hết), ĐVT "Gói", SL 1, đơn giá = giá gói, VAT như các dòng khác. Tiền gói vì thế nằm trong tiền hàng, VAT, tổng, cọc và nghiệm thu; không đổi backend/DB (loại dòng là chuỗi tự do). Dòng gói không tạo chỗ chấm Node. Mở lại hợp đồng đã lưu thì nhận gói đã tích theo mã dòng. Chưa làm trên web.

## Hợp đồng Zone là hợp đồng dịch vụ; bỏ số liệu tự bịa (2026-11-18)
- Nghiệp vụ của nhóm KHÔNG có chuyện Chủ trang trại cho bên khác thuê Zone. "Hợp đồng Zone" được hiểu là hợp đồng dịch vụ: khách hàng = Chủ trang trại, `MonthlyRentVnd` = **phí dịch vụ / tháng** (tên cột giữ nguyên). Mobile đổi nhãn: Khách hàng, Phí dịch vụ / tháng.
- Hợp đồng `HD-SR-…` sinh khi Owner ký báo giá lắp đặt: phí dịch vụ/tháng = **0 (chưa thiết lập)** thay vì tổng báo giá / 12 (trước đây gia hạn thu lại gần hết tiền lắp đặt kể cả thiết bị); SĐT và địa chỉ khách lấy từ hồ sơ Owner (`AppUser.Phone`) và địa điểm trang trại, không còn điền cứng `0903666888` / "Trang trại thông minh SmartFarm".
- Gia hạn (`RenewContractAsync`, chỉ PlatformAdmin) trả 400 khi phí dịch vụ/tháng ≤ 0: phải nhập `newMonthlyRentVnd`. Phí gia hạn = phí dịch vụ/tháng × số tháng gia hạn − chiết khấu; không bao giờ gồm thiết bị. Giá gói chỉ tính lúc tạo hợp đồng.
- `GetDepreciationsByZoneAsync` và bước 5 của `DataIntegrityHealer` không còn tự sinh hồ sơ khấu hao cho thiết bị chưa có (giá gốc cố định 3,5/4,8 triệu, ngày bắt đầu ngẫu nhiên theo mã thiết bị). Chỉ trả hồ sơ đã lập; mobile hiện "Chưa lập hồ sơ khấu hao nào". Seed demo trong Development (`EnsureSeed…`) giữ nguyên.
- Dữ liệu cũ đã bị ghi sẵn trong DB: dùng `scripts/fix-service-contract-data-2026-11-18.sql` (đã xem trước khi chạy; phần xóa khấu hao tự sinh để comment).
- Chưa đổi: hợp đồng mới `HD-SR-…` vẫn tự đánh dấu hợp đồng đang hiệu lực cũ của cùng Zone là `Renewed`; cần chủ sản phẩm chốt.

## Thông báo hợp đồng sắp hết hạn (2026-11-18)
- Trước đây chỉ có cảnh báo tính lúc mở màn (`GET /zone-contracts/expiring`), không có thông báo nào được gửi. Thêm `ContractExpiryWorker` (hosted service, quét mỗi 6 giờ và ngay khi khởi động) và loại thông báo `NotificationType.Contract` (cột `type` lưu chuỗi nên KHÔNG cần migration).
- Mốc nhắc: còn 30, 14, 7 ngày và khi đã hết hạn (chỉ trong 7 ngày đầu sau hạn). Hợp đồng `Terminated`/`Renewed` không nhắc. Mức: Warning khi còn >7 ngày, Critical khi ≤7 ngày hoặc đã hết hạn.
- Người nhận: mọi Chủ trang trại đang hoạt động của Tenant chứa hợp đồng, và mọi PlatformAdmin (Admin là người gia hạn, `POST /zone-contracts/{id}/renew`). Tenant khác không nhận.
- Chống trùng: `ReferenceId = contract-expiry:{contractId}:{yyyyMMdd của ngày hết hạn}:{mốc}` + `DeduplicateByReference`, nên mỗi (hợp đồng, kỳ, mốc, người nhận) chỉ một thông báo kể cả đã đọc/đã xóa; gia hạn đổi ngày hết hạn nên kỳ sau nhắc lại từ mốc 30.
- Mobile: chạm thông báo loại `Contract` mở màn Hợp đồng (chỉ Owner; vai trò khác chỉ đánh dấu đã đọc), nhãn "Hợp đồng". Chưa có kênh push.

## Phiếu dịch vụ trả tên trang trại và Zone (2026-11-18)
- `ServiceRequestView` thêm `FarmName` và `ZoneName` (tùy chọn, nạp kèm `Farm`/`Zone` trong `ServiceRequestService.Query()`). Lý do: kỹ thuật viên chỉ tải Zone của MỘT trang trại và, theo `TechnicianFarmScope`, mất quyền đọc trang trại khi phiếu đã Resolved/Closed, nên mobile không tự tra tên Zone/trang trại được cho phiếu của trang trại khác hoặc phiếu đã đóng (thẻ chỉ còn ngày tạo).
- Mobile (`serviceWhereOf`) ưu tiên `zoneName`/`farmName` của phiếu, chỉ khi thiếu mới tra theo danh sách Zone đã tải.


## Khấu hao thiết bị: phạm vi và dữ liệu (2026-11-18)
- Hồ sơ khấu hao chỉ do người dùng lập (không tự sinh, không seed). Đã xóa khỏi DB dev các dòng seed/tự sinh cũ (sao lưu ngoài repo).
- Đọc/tạo khấu hao theo Zone và theo Farm đi qua `VisibleZoneIdsAsync`: Owner theo tenant, kỹ thuật viên chỉ Zone của yêu cầu được giao (403 nếu khác), Admin toàn bộ.
- `startDate` không được ở tương lai (400). Giá trị khấu hao lũy kế/sổ sách luôn tính lại khi đọc; cột lưu sẵn chỉ là ảnh chụp lúc tạo.
- Còn mở: chưa có unique index theo `DeviceId`, chưa gộp các dòng trùng nếu phát sinh lại.
