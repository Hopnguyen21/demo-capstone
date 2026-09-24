# Finance and Device Service contract v1

This contract fills gaps in Flow 7–8 and normalizes API catalog entries #95 and #102.
Only the existing roles `FarmOwner`, `PlatformAdmin`, and `PlatformTechnician` participate.

## Farm finance

All finance records take Tenant scope from the authenticated Owner and retain UTC occurrence
timestamps. Amounts must be positive. Records with reporting history are archived, not deleted.

- `GET /api/v1/farms/{farmId}/finance/transactions` (`FINANCE-V1-01`, Owner): list income
  and expense records, optionally filtered by UTC range.
- `POST /api/v1/farms/{farmId}/finance/revenues` (`FINANCE-V1-02`, Owner): create income.
- `POST /api/v1/farms/{farmId}/finance/expenses` (`FINANCE-V1-03`, Owner): create an
  expense in `Material`, `Farmer`, `IoT`, `Maintenance`, or `Other`. Flow 7's `Employee`
  label is intentionally normalized to the canonical `Farmer` role vocabulary.
- `PUT /api/v1/farms/{farmId}/finance/transactions/{transactionId}` (`FINANCE-V1-04`,
  Owner): update amount, date, description, reference and expense category without changing
  income into expense or vice versa.
- `DELETE /api/v1/farms/{farmId}/finance/transactions/{transactionId}` (`FINANCE-V1-05`,
  Owner): archive a record.
- `GET /api/v1/farms/{farmId}/cash-flow-report` (#102, Owner): return income, expense and
  net cash flow (`income - expense`) for an optional inclusive UTC range.

## Device service lifecycle

- `POST /api/v1/farms/{farmId}/service-requests` (`SERVICE-V1-01`, Owner): create an Open
  request for a Device currently belonging to that Farm and Zone.
- `GET /api/v1/service-requests` (`SERVICE-V1-02`): Owner sees their Tenant; Admin sees all;
  Technician sees only requests assigned to them.
- `GET /api/v1/service-requests/{requestId}` (`SERVICE-V1-03`): same visibility rules.
- `POST /api/v1/service-requests/{requestId}/assign` (`SERVICE-V1-04`, PlatformAdmin): assign
  an active PlatformTechnician. Reassignment is audited.
- `POST /api/v1/service-requests/{requestId}/accept` (`SERVICE-V1-05`, assigned Technician):
  move `Assigned -> InProgress`.
- `POST /api/v1/service-requests/{requestId}/diagnosis` (`SERVICE-V1-06`, assigned
  Technician): record inspection, diagnosis, and proposed `Maintenance`, `Repair`, or
  `Replacement` resolution.
- `POST /api/v1/service-requests/{requestId}/work` (`SERVICE-V1-07`, assigned Technician):
  record maintenance/repair work performed.
- `POST /api/v1/service-requests/{requestId}/replacement` and
  `POST /api/v1/zones/{zoneId}/devices/{oldDeviceId}/hot-swap` (#95, assigned Technician):
  replace with an unassigned compatible Device from the same Farm. The old Device is
  decommissioned, the new Device is assigned to the same Zone, and an immutable old-new link
  plus assignment histories are retained.
- `POST /api/v1/service-requests/{requestId}/connection-tests` (`SERVICE-V1-08`, assigned
  Technician): store the observed test of the active/replacement Device.
- `POST /api/v1/service-requests/{requestId}/close` (`SERVICE-V1-09`, assigned Technician):
  close only when the latest test for the current Device succeeded. HTTP success alone never
  represents a passing hardware test.

Lifecycle: `Open -> Assigned -> InProgress -> Diagnosed -> WorkCompleted -> Verified -> Closed`.
Replacement may occur only after diagnosis selected `Replacement`. Tenant, Farm, Zone, old
Device, replacement Device, assigned Technician and connection-test parent chains are validated
server-side. Existing deployment-failure requests remain valid entry points at `Open`.
