# Suggested code slices

| Slice | Backend modules | UI/mobile | Done when |
| --- | --- | --- | --- |
| 1 | Auth, Tenant, User, role/zone access | Sign in, onboarding, invitations | Secure account lifecycle and cross-tenant tests |
| 2 | Farm, Field, Zone GIS, Crop, Profile, Season | Farm wizard and maps | Area and active season invariants tested |
| 3 | Device estimation, deployment requests, surveys, Gateway, Device, assignment, telemetry ingestion | Technician provisioning, live dashboard | Signed gateway message, dedup, historical query |
| 4 | Alert rules, alerts, notification | Alert review/ack | Two-cycle anti-flap and audit tests |
| 5 | Schedules, auto rules, manual commands | Control/irrigation screens | Interlock, 30 minute cutoff, ACK/timeouts |
| 6 | AI context, ask, apply | Advisory and approval | No command before Owner approval |
| 7 | Inventory, tasks, finance transactions, service requests, maintenance/replacement, reports | Operations | Scope gaps resolved and authorization tested |

For each slice, write migrations and seed only explicit reference data. Do not mark a slice done solely because routes are registered.
