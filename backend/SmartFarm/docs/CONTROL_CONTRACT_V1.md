# SmartFarm Control Contract v1

This contract reconciles Flow 3 with Schedule endpoints #50–#53, AutoRule endpoints #76–#79 and Control endpoints #80–#83 in `reference/API .docx`.

## Asynchronous command lifecycle

The canonical command states are `Pending`, `Sent`, `Acknowledged`, `Failed`, `TimedOut` and `Cancelled`. `POST .../command` returns HTTP 202 and a persisted command. `Pending` or `Sent` means only that SmartFarm accepted or published the request; neither state proves a valve, pump or relay moved. Only authenticated device feedback may move a sent command to `Acknowledged`, `Failed` or `Cancelled`.

Every transition appends an immutable command event with UTC timestamp, status, transport/error detail and device feedback where available. Late feedback after a terminal state is retained as an event but does not rewrite the terminal result. `Acknowledged` records the actuator-observed state and the server-calculated hardware cutoff time.

Manual commands require an `idempotencyKey`, unique inside the Tenant. Schedule and AutoRule commands use deterministic keys derived from the schedule/rule occurrence. This prevents HTTP retries or repeated automation evaluations from issuing duplicate hardware actions.

## MQTT boundary

`IActuatorCommandTransport` publishes a normalized downlink envelope and a separate emergency-stop/cancel envelope. The default MQTT adapter does not claim success without a configured broker connection. Tests replace it with an in-memory fake.

Device feedback enters through `IActuatorFeedbackAdapter`. The adapter authenticates MQTT client ID and SHA-256 certificate fingerprint, validates the topic `smartfarm/gateways/{gatewayId}/actuator-feedback`, and verifies that the command actuator belongs to a Device behind that Gateway. Payload fields cannot choose Tenant or bypass the command's Zone.

## Safety and arbitration

- Irrigation duration is 1–1800 seconds and must not exceed the actuator's configured `max_duration_minutes`. The cutoff is carried in every downlink.
- Pump interlock permits only one active water pump per Zone. `Sent` commands and acknowledged commands whose cutoff has not elapsed are active.
- Rain probability comes from server-side `IRainForecastProvider`, never request data. Irrigation with rain delay enabled is refused/postponed at or above its configured threshold. Missing weather data is a safe refusal for automated irrigation.
- A manual command has higher priority than Schedule and AutoRule. Without `overrideActiveSchedules`, an active lower-priority command conflicts. With it, SmartFarm sends an emergency stop and keeps the manual command `Pending`; it dispatches only after authenticated cancellation feedback. Manual work is never preempted by automation.
- A cancellation request for a sent or acknowledged command publishes emergency stop and records `cancellationRequestedAtUtc`. The command becomes `Cancelled` only after device feedback. A pending command can be cancelled locally because no downlink was sent.
- Sent commands have an acknowledgement deadline. Expiry changes them to `TimedOut`; a broker/connection failure changes the command to `Failed` with an explicit error.

## Schedule contract

The source calls the field Quartz Cron but its examples are five-field expressions such as `0 6 * * *`. Control v1 therefore supports five fields `minute hour day-of-month month day-of-week`, with numeric minute/hour or `*` and wildcards for the remaining fields. Evaluation uses the Farm IANA timezone and stores `nextRunAtUtc`. Schedule creation/update checks overlapping execution windows for the same Zone and archives rather than deletes schedules with history.

FarmOwner manages schedules. FarmOwner and an assigned Farmer may list them. Schedule execution creates ordinary actuator commands with source `Schedule`; rain postponement advances the next occurrence without claiming actuator execution.

## AutoRule contract

AutoRule v1 supports `LessThan`, `LessThanOrEqual`, `GreaterThan` and `GreaterThanOrEqual` over a metric measured in the Zone. The condition must remain true for `conditionDurationMinutes` before firing. The action targets an actuator in the same Zone, respects a 30-minute maximum, interlock, rain delay and cooldown, and creates a command with source `AutoRule`.

Rules are evaluated after accepted telemetry. Rule CRUD never reports `syncedToGateway: true` because offline Gateway rule compilation/downlink ACK is not yet defined. This intentionally replaces the source's unsupported success claim. Rules are archived, and a rule with an active command cannot be archived.

## Access and history

FarmOwner can control every Zone in the JWT Tenant. Farmer must belong to that Farm, be assigned to the Zone and have `can_control = true` for command/cancel operations; read-only status and history require Zone assignment. Cross-Tenant resources are returned as not found.

`GET .../actuators/{actuatorId}/status` derives state only from acknowledged device feedback and its cutoff. `GET .../actuators/history` returns command source (`Manual`, `Schedule`, `AutoRule`, `AiApproved`), actor, state transitions and failure details. AI-created commands remain out of scope until an Owner approval supplies the recommendation ID.
