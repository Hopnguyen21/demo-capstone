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
