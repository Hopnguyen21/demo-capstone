# AI Recommendation contract v1

This contract normalizes Flow 4 and API catalog endpoints #84-#88. It overrides the source wording where `apply-recommendation` appears to create irrigation immediately.

## Safety boundary

- AI is advisory. An AI provider never calls MQTT, creates an actuator command, changes a Schedule or changes an AutoRule.
- A recommendation may propose a control action, but only an authenticated `FarmOwner` in the recommendation Tenant may accept it.
- Acceptance invokes the Phase 7 control use case. The resulting command records `recommendation_id` and trigger source `AI_APPROVED`; physical success still requires authenticated Gateway feedback.
- Rejected, ignored, insufficient-data, low-confidence, expired and superseded recommendations cannot create commands.

## Context and uncertainty

`GET /api/v1/zones/{zoneId}/ai/context` (#84) builds context on the server from the JWT Tenant and complete Farm -> Field -> Zone chain. It includes the active Crop/Variety, Growth Profile and Stage, applied thresholds, latest telemetry freshness, and weather availability. Client-supplied Tenant, Farm, Crop, Stage, telemetry or weather values are never trusted as context.

An active season, current stage, fresh telemetry and available weather are mandatory for an actionable recommendation. Missing inputs are listed explicitly. The API returns a limited context/recommendation instead of inventing values. Provider output below `Ai:MinimumConfidence` is stored as `LowConfidence`, includes its limitations and is not actionable.

The provider receives a structured context and untrusted user question through `IAiAdvisoryProvider`. The default provider is unavailable and returns an explicit limitation; tests replace it with a fake provider.

## Consultation and rate limit

`POST /api/v1/zones/{zoneId}/ai/ask` (#85) accepts a Vietnamese natural-language question of 3-2000 characters. Requests are persisted before provider invocation. Each Owner/Zone is limited by `Ai:MaxRequestsPerWindow` over `Ai:RateLimitWindowMinutes`; excess requests return HTTP 429 with a retry interval. Provider failures are stored and returned as a limited result.

Recommendations expire after `Ai:RecommendationValidityMinutes`. An action proposed by the provider is retained only when its actuator belongs to the Zone and its duration is within the actuator and 30-minute limits.

## Owner decision

`POST /api/v1/zones/{zoneId}/ai/apply-recommendation` (#86) records exactly one of:

- `Accepted`: allowed only for a current, actionable, sufficiently confident recommendation. It creates a Phase 7 command with source `AI_APPROVED` and returns that command in `Sent`, `Failed`, or `Pending` state; it never reports physical execution success.
- `Rejected`: records the Owner reason and creates no command.
- `Ignored`: records the decision and creates no command.
- `MoreAnalysisRequested`: requires a follow-up question, records the decision, and creates a linked follow-up consultation. The original recommendation becomes superseded.

Every decision is append-only in `ai_recommendation_decisions`. A recommendation cannot be decided twice.

## History

`GET /api/v1/zones/{zoneId}/ai/history` (#87) returns consultations and recommendations from the last 30 days for the current Tenant and Zone.

`DELETE /api/v1/zones/{zoneId}/ai/history` (#88) hides the conversation from subsequent history queries. It does not delete consultation, recommendation, decision or actuator-command audit records.

Knowledge-base endpoints #89-#90 remain deferred until pgvector availability, document provenance, malware scanning and administrative ingestion policy are settled. This slice does not assume the extension exists.
