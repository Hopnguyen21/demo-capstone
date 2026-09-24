# Reporting contract and formulas v1

Reports are read models over implemented SmartFarm data. They never accept a Tenant identifier;
Tenant and Farm scope come from the authenticated user. Catalog reports #91–#94 require
`FarmOwner`. Additional Inventory, Task, and Maintenance reports use the same FarmOwner scope.

## Endpoints and sources

- `GET /api/v1/farms/{farmId}/report/overview` (#91): Farm, Field, Zone, PlantingSeason,
  Device, Alert, FarmTask, InventoryItem, ServiceRequest, and FinanceTransaction.
- `GET /api/v1/zones/{zoneId}/report/season-summary` (#92): latest InProgress or most
  recently ended PlantingSeason, its Crop/Variety/GrowthStage, Alerts, acknowledged actuator
  commands, inventory issues, and the previous completed season.
- `GET /api/v1/farms/{farmId}/report/water-usage` (#93): acknowledged `TurnOn` commands and
  `DeviceActuator.flow_rate_liters_per_minute`, grouped by Zone and UTC month.
- `GET /api/v1/farms/{farmId}/report/electricity` (#94): acknowledged `TurnOn` commands and
  `DeviceActuator.rated_power_watt`, grouped by Zone and UTC month.
- `GET /api/v1/farms/{farmId}/report/inventory` (`REPORT-V1-01`): current item balance,
  threshold/open low-stock alert, and receipt/issue totals in the requested range.
- `GET /api/v1/farms/{farmId}/report/tasks` (`REPORT-V1-02`): task counts by state,
  approval completion rate, failures, overdue work, and assignee workload.
- `GET /api/v1/farms/{farmId}/cash-flow-report` (#102): active FinanceTransaction records.
- `GET /api/v1/farms/{farmId}/report/maintenance` (`REPORT-V1-03`): ServiceRequest status,
  resolution action, elapsed service time, connection tests, and DeviceReplacement links.

All optional report ranges are inclusive UTC. Detailed reports default to the last 12 UTC months.

## Formulas

- `netCashFlow = sum(Revenue.amount) - sum(Expense.amount)`; archived rows are excluded.
- `waterLiters = acknowledgedTurnOn.durationSeconds / 60 * flowRateLitersPerMinute`.
- `electricityKWh = acknowledgedTurnOn.durationSeconds / 3600 * ratedPowerWatt / 1000`.
- `taskCompletionRatePercent = Approved / (all non-Cancelled tasks) * 100`.
- `serviceElapsedHours = (closedAtUtc ?? reportGeneratedAtUtc) - createdAtUtc`.

Only commands whose authenticated feedback produced `Acknowledged` are counted. Requested,
Sent, Failed, TimedOut, and Cancelled commands contribute zero. Commands whose actuator lacks the
required flow or power rating are excluded from the numeric total and counted in
`unmeasuredCommandCount`.
