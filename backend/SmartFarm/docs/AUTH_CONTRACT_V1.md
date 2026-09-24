# SmartFarm Auth User Tenant Contract v1

This contract resolves the Auth, User and Tenant conflicts in `reference/API .docx`. It is normative for the first backend slice and preserves the original endpoint numbers where they exist.

## Canonical roles and account scope

Only `PlatformAdmin`, `PlatformTechnician`, `FarmOwner` and `Farmer` exist.

- PlatformAdmin and PlatformTechnician have no Tenant or Farm membership.
- A newly registered FarmOwner has no Tenant until first-Farm setup begins.
- A newly registered Farmer has no Tenant or Farm until invited by an Owner.
- An assigned Farmer belongs to exactly one Farm and inherits that Farm's Tenant.
- Farmer Zone access may include multiple Zones, but every Zone must belong to the Farmer's assigned Farm.
- Public callers cannot register a platform role. PlatformAdmin is the only role that can create or manage PlatformTechnician accounts.

## Authentication

### AUTH-V1-01 POST `/api/v1/auth/register`

Anonymous self-registration for `FarmOwner` or `Farmer` only.

Input: `email`, `fullName`, optional `phone`, `password`, and `role`. Password is 8–100 characters and must contain upper-case, lower-case, number and special characters. Email is globally unique.

Output: `userId`, `email`, `role`, `status`, `createdAtUtc`. It never returns password material or tokens.

### #1 POST `/api/v1/auth/login`

Input: `email`, `password`. Output: access token, refresh token, expiry seconds and user summary. Invalid credentials return 401 without revealing whether the email exists. Disabled accounts return 403. Five consecutive failures lock the account for 15 minutes.

JWT claims are `sub`, `role`, `jti`, `iat`, `exp`; `tenant_id` and `farm_id` are optional and emitted only when assigned. This replaces the source requirement that every role has `tenantId`.

### #2 POST `/api/v1/auth/logout`

Requires a valid access token. An optional refresh token revokes that session; `revokeAllDevices=true` revokes every active session for the current user. If neither is supplied, the current access-token session is revoked. Response contains only `revokedAtUtc` and `revokedSessions`.

### #3 POST `/api/v1/auth/refresh`

Accepts an opaque refresh token, rotates it once, revokes the old session and returns a new access/refresh pair. Expired, revoked or replayed tokens return 401. Only SHA-256 refresh-token hashes are persisted.

Endpoints #4 and #5 are deferred until the notification/email provider and OTP storage contract are approved.

## Tenant and Farmer membership

### #13 POST `/api/v1/tenants/register`

Requires an authenticated FarmOwner with no current Tenant. Input is `companyName`, `subdomain`, optional `taxCode`, `address` and `logoUrl`. The transaction creates the Tenant and attaches the current Owner account. It does not create an Owner account and does not accept admin email/password fields. This endpoint is the Tenant step of first-Farm setup; API #17 creates the first Farm afterward from authenticated Tenant context.

### #10 POST `/api/v1/users/invite`

Requires FarmOwner. Input is `email` and exactly one `farmId`. The email must identify an existing active, unassigned Farmer. The Farm must belong to the Owner's Tenant. The transaction assigns both `tenantId` and `farmId`. Output contains `userId`, `farmId`, `tenantId`, `status` and `assignedAtUtc`; no temporary password is created or returned.

### USER-V1-01 PUT `/api/v1/users/{userId}/zone-access`

Requires FarmOwner. Input is an `access` array of `{ zoneId, canControl }`. The Farmer must belong to the Owner's Tenant and each Zone must resolve through Zone → Field → Farm to that Farmer's single Farm. The operation replaces the Farmer's complete Zone-access set transactionally.

## User and Tenant reads

- #6 `GET /api/v1/users`: FarmOwner-only, Tenant derived from claims; returns Tenant members and never platform users.
- #7 `GET /api/v1/users/{userId}`: FarmOwner-only and same-Tenant; cross-Tenant IDs return 404.
- #11 `GET /api/v1/users/me`: any authenticated role; Tenant/Farm are nullable.
- #14 `GET /api/v1/tenants/me`: FarmOwner-only; Tenant comes from claims.
- #15 `PUT /api/v1/tenants/me`: FarmOwner-only; subdomain is immutable.

Endpoints #8, #9 and #12 are deferred to the next User lifecycle increment. PlatformTechnician lifecycle uses the platform routes in `API_CATALOG.md` rather than overloading Tenant-scoped endpoints.

## Session security and errors

- Access token lifetime: 60 minutes. Refresh token lifetime: 30 days. Clock skew: zero.
- Refresh rotation, Tenant creation, Farmer assignment and Zone-access replacement are transactional.
- Authentication and authorization errors use 401 and 403. Missing same-Tenant resources use 404 to avoid leaking cross-Tenant existence. Conflicting membership or unique fields use 409. Validation uses RFC 7807-compatible 400 responses.
- JWT signing keys and database credentials are environment configuration only.
