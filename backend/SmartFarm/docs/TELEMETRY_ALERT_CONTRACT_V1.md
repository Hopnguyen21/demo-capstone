# SmartFarm Telemetry and Alert Contract v1

This contract reconciles Flow 2 with endpoints #46–#49 and #69–#75 in `reference/API .docx`.

## MQTT trust boundary

Telemetry enters through `IMqttTelemetryAdapter`, not a public user HTTP endpoint. The adapter accepts broker-provided client identity, certificate fingerprint, topic and payload bytes. It validates topic shape and JSON syntax, then passes a normalized envelope to `ITelemetryIngestionService`. Business validation, idempotency, persistence and alert evaluation do not depend on an MQTT client library and can be tested without a broker.

The authenticated Gateway identity comes only from the transport context. Payload fields cannot select a Gateway or Tenant. The topic is `smartfarm/gateways/{gatewayId}/telemetry`. A message is accepted only when client ID and SHA-256 certificate fingerprint match the registered Gateway and the Device belongs to that Gateway, is assigned to the payload Zone, and is not decommissioned. Gateway provisioning records both transport identifiers; the fingerprint is never returned in a read response.

Payload contract:

```json
{
  "messageId": "01J8MQTT7J7D9B",
  "deviceId": "uuid",
  "zoneId": "uuid",
  "capturedAtUtc": "2026-09-24T12:00:00Z",
  "readings": [
    { "parameterCode": "SoilMoisture", "value": 54.2, "unit": "%" }
  ]
}
```

`messageId` is 1–100 characters, timestamps must be UTC and cannot be more than five minutes in the future or more than seven days old, readings must be non-empty with unique parameter codes, physically valid values and the unit registered on the current stage requirement. PostgreSQL unique constraints enforce both `(deviceId, messageId, parameterCode)` and `(deviceId, capturedAtUtc, parameterCode)`. A duplicate envelope returns an idempotent duplicate result with no new rows and never increments anti-flap state.

## Current thresholds and anti-flap

The evaluator loads the Zone's one `InProgress` season and its `CurrentGrowthStageId`. It compares each reading with `season_applied_requirements`, which are replaced transactionally on stage transition. System-generated Alert Rules are synchronized lazily for the current stage and therefore never reuse stale stage thresholds.

Owner-created rules are scoped to the current stage. Metric and severity are unique per Zone and stage. Each rule stores an independent evaluation state. A violation increments the consecutive count; an in-range value resets it to zero. An alert is created only after two consecutive violations. No additional alert is created while an unresolved alert for the same Zone, metric and severity exists or until `cooldownMinutes` has elapsed after the last alert. Duplicate messages never count as another cycle.

## Alert lifecycle and access

Endpoint #75 is normalized to acknowledgement only. It appends an `Acknowledged` history event and retains the alert. The source body fields `actionTaken` and `notes`, which actually resolve an alert, move to the added endpoint below:

| Contract ID | Method | Path | Actor | Purpose |
| --- | --- | --- | --- | --- |
| ALERT-V1-01 | PUT | `/api/v1/alerts/{alertId}/resolve` | FarmOwner or assigned Farmer | Record action, resolve alert and append history |

Alert history is append-only and contains system creation, acknowledgement and resolution events with actor and UTC timestamp. Opening alert detail does not silently mutate `isRead`; that source behavior is deferred until notification/read-state semantics are defined.

FarmOwner may read every Zone in the JWT Tenant. Farmer may read, acknowledge or resolve only Alerts whose Zone appears in `user_zone_accesses`. Cross-Tenant resources return 404. Rule writes and telemetry stats remain FarmOwner-only; assigned Farmer may list effective rules and read latest/history.

## Freshness and online state

Latest telemetry includes `receivedAtUtc` and `isFresh`, computed against a five-minute freshness window. Old data remains queryable but never changes a Device to `Online` and is never presented as proof of current connectivity. Device connectivity continues to depend on recent connection feedback, not the mere existence of historical telemetry.

Base PostgreSQL stores readings in this phase. History aggregation supports `1m`, `5m`, `15m`, `1h` and `1d` with LINQ grouping and a 90-day request limit. A future TimescaleDB migration can replace the query implementation without changing the API contract.
