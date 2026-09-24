# Codex instructions for SmartFarm

Read `README.md`, `docs/DECISIONS.md`, `docs/API_CATALOG.md` and the relevant numbered section of `docs/reference/API.docx` before implementing an endpoint. Review `docs/reference/SmartFarm_Flow.docx` for all eight business flows. The DOCX API has 103 indexed endpoints; introductory counts of 102 are stale. Treat detailed endpoint contracts as proposed requirements, and report inconsistencies rather than silently inventing a policy.

## Implementation order

Work as vertical slices: auth/tenant first; then farm/field/zone; then crop/growth/season; device estimation, deployment request, technician survey and onboarding; telemetry/alerts; control; AI; inventory, tasks, finance, service/maintenance and reporting. Deliver one coherent slice at a time, with migration and tests. Preserve existing files and conventions.

## Non-negotiable invariants

- Four roles: PlatformAdmin, PlatformTechnician, FarmOwner, Farmer. Platform staff are not members of a farm tenant. Farmer belongs to exactly one Farm; zone access may cover multiple zones in that Farm. Owner invites an existing account into their Farm; settle account registration/invitation contract before implementation.
- Tenant isolation: take tenantId from authenticated server context, never a client supplied field. Check the full resource parent chain on nested routes. Authorization attributes alone do not prove access to a specific farm/zone.
- Farm → Field → Zone; a zone has at most one InProgress season; system growth profiles must be cloned before tenant edits. Archive rather than delete records that have operational/audit history.
- Acknowledged alerts and all actuator commands retain audit history. IoT telemetry is idempotent by device/message identity and timestamp; only authenticated gateways may publish trusted data.
- Commands are asynchronous: Pending → Sent → Acknowledged/Failed/TimedOut/Cancelled. Require device feedback before displaying execution success. Enforce hardware cutoff <= 30 minutes and server checks for interlock, rain delay, role, zone permission, stale telemetry, and duplicate commands.
- AI recommendations never directly actuate. Only an authorized Owner action may create a command; record its recommendation ID and origin. Missing/uncertain AI context must yield an explicit refusal or fallback, never fabricated guidance.
- Store UTC timestamps and use farm timezone for presentation/scheduling. Secrets only via configuration/environment, never source control.

## Code conventions

Backend: .NET 8, Clean Architecture; Domain has no framework references, Application depends on Domain, Infrastructure implements Application interfaces, Api wires dependencies. EF migrations live in Infrastructure. Use cancellation tokens, validation, Problem Details and request correlation. Controllers or route groups should remain thin. Store all write operations involving related records in a transaction. Choose exact NuGet package versions and record them when implementing persistence/auth.

Frontend: typed API client and features organized by domain. Auth context and route access are user experience guards; backend is the authority. Handle loading, empty, 401/403 and API errors. Do not store refresh tokens in localStorage without agreeing on session design.

For every endpoint: cite its index in `docs/API_CATALOG.md`, implement the source document's input/output/validation/exception cases, test cross-tenant and wrong-zone access, and update docs if an intentional difference is approved. No placeholder 200 response or mock production data.

Flow 6 in `SmartFarm_Flow.docx` says Manager/Employee. Interpret these as FarmOwner/Farmer per agreed four-role model, and reconcile the source before adding any other role. Distinguish deployment request/survey/plan/installation from device provisioning and zone assignment. Model service request, technician work and maintenance/replacement as explicit operations.

Database strategy: EF Core Code First. Read `docs/CODE_FIRST.md`. Schema migrations are authored in Infrastructure and applied explicitly. Do not reverse engineer entities from an existing database.
