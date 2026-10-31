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

A task can be assigned to several Farmers. Each task–Farmer pair is a `FarmTaskAssignment`
(unique per pair) with its own status, progress (0-100), note, result or failure reason and
timestamps. `FarmTask.Status` is only an aggregate computed from the active assignments
(`Cancelled` and `Declined` are ignored): all `Approved` → `Approved`; otherwise the least
advanced of `InProgress`, `Accepted`, `Pending`, `CompletedPendingReview`, `Overdue`, `Failed`.
If every assignment declined the task is `Failed` (needs the Owner); if every Farmer was removed it is `Cancelled`.

- `GET /api/v1/farms/{farmId}/tasks` (#99): Owner sees every assignment and the full history.
  A Farmer only receives tasks they are actively assigned to, and in those only their own
  assignment and the history events about themselves or the task in general (never another
  Farmer's result, note or events). Active past-due assignments are marked `Overdue`.
- `POST /api/v1/farms/{farmId}/tasks` (#100, Owner): body carries `farmerIds` (1-50, duplicates
  collapsed). Every Farmer must be an active member of that Farm **and** already have Zone access;
  otherwise the request fails with 409 naming the Farmers that lack access. Assigning work never
  grants Zone access or device control. The task and all assignments are saved in one transaction;
  one in-app notification per Farmer is sent only after the save and a notification failure never
  loses the task.
- `PUT /api/v1/farms/{farmId}/tasks/{taskId}` (#101): one explicit action.
  Farmer (own assignment only): `Accept`, `Decline` (Pending/Accepted), `Start`,
  `UpdateProgress` (`progressPercent` 0-100, moves Accepted → InProgress), `Complete` (needs `result`),
  `Fail` (needs `failureReason`). Owner: `Approve` (`farmerId` required when several results wait),
  legacy `Reassign` (= add the Farmer again).
- `POST /api/v1/farms/{farmId}/tasks/{taskId}/assignees` (Owner): adds Farmers or re-assigns those
  whose assignment is `Failed`, `Overdue`, `Declined` or removed (same row, `assignmentVersion` + 1, result
  cleared). Optional `newDueAtUtc` is required when the deadline has passed. A finished task is reopened
  when someone is added.
- `DELETE /api/v1/farms/{farmId}/tasks/{taskId}/assignees/{farmerId}` (Owner): marks the assignment
  `Cancelled`; refused after the result was approved.

Notifications (`NotificationType.Task`, deduplicated by `ReferenceId` = `ft:{taskId:N}:{f|o}:{farmerId:N}:v{version}:{event}`):
the Farmer is notified when assigned, re-assigned, removed or when their result is approved; the Owner is
notified when a Farmer declines, submits or reports failure. `TargetUrl` opens the task.

Assignment status flow: `Pending → Accepted → InProgress → CompletedPendingReview → Approved`;
`Pending|Accepted → Declined`; `Pending|Accepted|InProgress → Failed`; active work past its deadline
becomes `Overdue`; removed by the Owner → `Cancelled`. Every stock movement, assignment and status
transition is retained as audit history (UTC) with the Farmer it concerns.

## Farm invitations

- `POST /api/v1/farms/{farmId}/invitations` (also legacy `POST /api/v1/users/invite`, Owner): the email must
  belong to an active Farmer account that is not yet in any Farm. Unknown accounts, other roles and accounts
  of another Tenant all return the same 404 message (no Tenant leakage). One pending invitation per Farm and
  email; invitations expire after `Invitations:ExpiryDays` (default 7). The invitation is delivered as an
  in-app notification to the Farmer (no email provider is used).
- `GET /api/v1/farm-invitations/mine`, `POST .../{id}/accept`, `POST .../{id}/decline` (Farmer): only the
  account whose email matches may respond. Accepting runs in one serializable transaction, sets the Farmer's
  Tenant/Farm, never creates Zone access, notifies the Owner and makes repeated or concurrent accepts fail with 409.
  A Farmer already in a Farm cannot accept. The Farmer needs a new token (refresh/sign in) to carry Tenant scope.
- Owner: `GET .../invitations`, `POST /api/v1/farm-invitations/{id}/resend`, `.../cancel` (pending only).
