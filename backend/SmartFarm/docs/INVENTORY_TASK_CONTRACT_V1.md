# Inventory and Task contract v1

This document reconciles Flow 5–6 with API catalog entries #96–#101. `Manager` means
`FarmOwner`, and `Employee` means `Farmer`; no additional roles are introduced.

## Inventory

- `GET /api/v1/farms/{farmId}/inventory` (#96): Owner sees the tenant Farm; a Farmer
  sees only their Farm.
- `POST /api/v1/farms/{farmId}/inventory` (#97, Owner): creates one unique material
  (case-insensitive name per Farm). Optional initial quantity is audited as a receipt;
  this endpoint never silently upserts an existing item.
- `POST /api/v1/farms/{farmId}/inventory/{itemId}/receipts` (v1 addition, Owner):
  receives positive stock and resolves an open low-stock alert when appropriate.
- `PUT /api/v1/farms/{farmId}/inventory/{itemId}/requirements` (v1 addition, Owner):
  replaces requirement links. Each link targets exactly one Crop, Variety, or Growth
  Stage visible to the tenant.
- `POST /api/v1/farms/{farmId}/inventory/issues` (#98, Owner/Farmer): atomically issues
  positive stock to a Zone and optionally a Task. The full Farm→Field→Zone and Task
  chain is checked. A Farmer must be assigned to the Task or have Zone access. Stock
  may never become negative.
- `GET /api/v1/farms/{farmId}/inventory/low-stock-alerts` (v1 addition, Owner): lists
  open and resolved low-stock alerts. Crossing to or below the configured threshold
  opens one alert; receipt above it resolves that alert.

## Tasks

- `GET /api/v1/farms/{farmId}/tasks` (#99): Owner sees Farm tasks; Farmer sees only
  tasks assigned to them. Active past-due tasks are marked `Overdue`.
- `POST /api/v1/farms/{farmId}/tasks` (#100, Owner): creates a task for a Zone and
  assigns an active Farmer belonging to that same Farm and authorized for that Zone.
- `PUT /api/v1/farms/{farmId}/tasks/{taskId}` (#101): performs one explicit action.
  Farmer actions are `Accept`, `Start`, `Complete`, and `Fail` and only the assignee
  may use them. Owner actions are `Approve` and `Reassign`; reassignment is permitted
  only after `Failed` or `Overdue` and must target an eligible Farmer.

State flow: `Pending → Accepted → InProgress → CompletedPendingReview → Approved`;
`Pending|Accepted|InProgress → Failed`; active work past its deadline becomes
`Overdue`; `Failed|Overdue → Pending` on reassignment. Every stock movement,
assignment and status transition is retained as audit history using UTC timestamps.
