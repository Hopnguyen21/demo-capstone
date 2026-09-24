# 103-endpoint implementation status

Audited against the numbered catalog in `API_CATALOG.md` and concrete controller actions on 2026-09-25. `Implemented` means a route delegates to application/infrastructure logic; a declaration or empty response alone is not sufficient. `Deferred` means the source contract exists but this slice is not implemented. `Contract missing` means a security/provider/lifecycle decision is still required before implementation.

| # | Status | Code evidence or reason |
| ---: | --- | --- |
| 1 | Implemented | `AuthController.Login` → `IAuthService` |
| 2 | Implemented | `AuthController.Logout` → `IAuthService` |
| 3 | Implemented | `AuthController.Refresh` → `IAuthService` |
| 4 | Deferred | Password recovery delivery/token lifecycle not implemented |
| 5 | Deferred | Password recovery delivery/token lifecycle not implemented |
| 6 | Implemented | `UsersController.List` → `IUserService` |
| 7 | Implemented | `UsersController.Get` → `IUserService` |
| 8 | Deferred | User profile update not implemented |
| 9 | Deferred | User archive/delete not implemented |
| 10 | Implemented | `UsersController.Invite` → `IUserService` |
| 11 | Implemented | `UsersController.Me` → `IUserService` |
| 12 | Deferred | Password-change route/use case not implemented |
| 13 | Implemented | `TenantsController.Register` → `ITenantService` |
| 14 | Implemented | `TenantsController.Me` → `ITenantService` |
| 15 | Implemented | `TenantsController.Update` → `ITenantService` |
| 16 | Implemented | `FarmsController.List` → `IFarmService` |
| 17 | Implemented | `FarmsController.Create` → `IFarmService` |
| 18 | Implemented | `FarmsController.Get` → `IFarmService` |
| 19 | Implemented | `FarmsController.Update` → `IFarmService` |
| 20 | Implemented | `FarmsController.Archive` → `IFarmService` |
| 21 | Implemented | `FarmsController.Structure` → `IFarmService` |
| 22 | Deferred | Wizard submit lifecycle remains explicitly deferred |
| 23 | Implemented | `FieldsController.List` → `IFieldService` |
| 24 | Implemented | `FieldsController.Create` → `IFieldService` |
| 25 | Implemented | `FieldsController.Get` → `IFieldService` |
| 26 | Implemented | `FieldsController.Update` → `IFieldService` |
| 27 | Implemented | `FieldsController.Archive` → `IFieldService` |
| 28 | Implemented | `ZonesController.List` → `IZoneService` |
| 29 | Implemented | `ZonesController.Create` → `IZoneService` |
| 30 | Implemented | `ZonesController.Get` → `IZoneService` |
| 31 | Implemented | `ZonesController.Update` → `IZoneService` |
| 32 | Implemented | `ZonesController.Archive` → `IZoneService` |
| 33 | Implemented | `CropGrowthController.Crops` → `ICropGrowthService` |
| 34 | Implemented | `CropGrowthController.CreateCrop` → `ICropGrowthService` |
| 35 | Implemented | `CropGrowthController.Varieties` → `ICropGrowthService` |
| 36 | Implemented | `CropGrowthController.CreateVariety` → `ICropGrowthService` |
| 37 | Implemented | `CropGrowthController.Profiles` → `ICropGrowthService` |
| 38 | Implemented | `CropGrowthController.CreateProfile` → `ICropGrowthService` |
| 39 | Implemented | `CropGrowthController.Stages` → `ICropGrowthService` |
| 40 | Implemented | `CropGrowthController.Requirements` → `ICropGrowthService` |
| 41 | Implemented | `PlantingSeasonsController.List` → `ICropGrowthService` |
| 42 | Implemented | `PlantingSeasonsController.Create` → `ICropGrowthService` |
| 43 | Implemented | `PlantingSeasonsController.Get` → `ICropGrowthService` |
| 44 | Implemented | `PlantingSeasonsController.Stage` → `ICropGrowthService` |
| 45 | Implemented | `PlantingSeasonsController.Close` → `ICropGrowthService` |
| 46 | Implemented | `AlertRulesController.List` → `ITelemetryAlertService` |
| 47 | Implemented | `AlertRulesController.Create` → `ITelemetryAlertService` |
| 48 | Implemented | `AlertRulesController.Update` → `ITelemetryAlertService` |
| 49 | Implemented | `AlertRulesController.Archive` → `ITelemetryAlertService` |
| 50 | Implemented | `SchedulesController.List` → `IControlService` |
| 51 | Implemented | `SchedulesController.Create` → `IControlService` |
| 52 | Implemented | `SchedulesController.Update` → `IControlService` |
| 53 | Implemented | `SchedulesController.Archive` → `IControlService` |
| 54 | Implemented | `IoTHardwareController.Gateways` → `IIoTDeploymentService` |
| 55 | Implemented | `IoTHardwareController.ProvisionGateway` → `IIoTDeploymentService` |
| 56 | Implemented | `IoTHardwareController.Gateway` → `IIoTDeploymentService` |
| 57 | Implemented | `IoTHardwareController.Firmware` → `IIoTDeploymentService` |
| 58 | Implemented | `IoTHardwareController.FarmDevices` → `IIoTDeploymentService` |
| 59 | Implemented | `IoTHardwareController.ZoneDevices` → `IIoTDeploymentService` |
| 60 | Implemented | `IoTHardwareController.Device` → `IIoTDeploymentService` |
| 61 | Implemented | `IoTHardwareController.ProvisionDevices` → `IIoTDeploymentService` |
| 62 | Implemented | `IoTHardwareController.Sensors` → `IIoTDeploymentService` |
| 63 | Implemented | `IoTHardwareController.Actuators` → `IIoTDeploymentService` |
| 64 | Implemented | `IoTHardwareController.Assign` → `IIoTDeploymentService` |
| 65 | Implemented | `IoTHardwareController.Unassign` → `IIoTDeploymentService` |
| 66 | Implemented | `IoTHardwareController.Ping` reads recorded connection results |
| 67 | Implemented | `IoTHardwareController.Diagnose` creates asynchronous diagnostic job |
| 68 | Implemented | `IoTHardwareController.Decommission` → `IIoTDeploymentService` |
| 69 | Implemented | `TelemetryController.Latest` → `ITelemetryAlertService` |
| 70 | Implemented | `TelemetryController.History` → `ITelemetryAlertService` |
| 71 | Implemented | `TelemetryController.Stats` → `ITelemetryAlertService` |
| 72 | Implemented | `AlertsController.Farm` → `ITelemetryAlertService` |
| 73 | Implemented | `AlertsController.Zone` → `ITelemetryAlertService` |
| 74 | Implemented | `AlertsController.Get` → `ITelemetryAlertService` |
| 75 | Implemented | `AlertsController.Acknowledge` → `ITelemetryAlertService` |
| 76 | Implemented | `AutoRulesController.Create` → `IControlService` |
| 77 | Implemented | `AutoRulesController.List` → `IControlService` |
| 78 | Implemented | `AutoRulesController.Update` → `IControlService` |
| 79 | Implemented | `AutoRulesController.Archive` → `IControlService` |
| 80 | Implemented | `ControlController.Command` → asynchronous `IControlService` command |
| 81 | Implemented | `ControlController.Status` reads command/device state |
| 82 | Implemented | `ControlController.Cancel` → asynchronous cancellation |
| 83 | Implemented | `ControlController.History` → command audit history |
| 84 | Implemented | `AiAdvisoryController.Context` → `IAiAdvisoryService` |
| 85 | Implemented | `AiAdvisoryController.Ask` → provider abstraction |
| 86 | Implemented | `AiAdvisoryController.Decide` → Owner-approved control handoff |
| 87 | Implemented | `AiAdvisoryController.History` → persisted recommendations |
| 88 | Implemented | `AiAdvisoryController.HideHistory` archives AI history |
| 89 | Contract missing | Knowledge ingestion format, pgvector and access/audit policy unresolved |
| 90 | Contract missing | Knowledge ingestion format, pgvector and access/audit policy unresolved |
| 91 | Implemented | `ReportsController.Overview` → `IReportService` |
| 92 | Implemented | `ReportsController.Season` → `IReportService` |
| 93 | Implemented | `ReportsController.Water` → acknowledged-command calculation |
| 94 | Implemented | `ReportsController.Electricity` → acknowledged-command calculation |
| 95 | Implemented | `ServiceRequestsController.HotSwap` → audited replacement lifecycle |
| 96 | Implemented | `InventoryTasksController.Inventory` → `IInventoryTaskService` |
| 97 | Implemented | `InventoryTasksController.CreateItem` → `IInventoryTaskService` |
| 98 | Implemented | `InventoryTasksController.Issue` → audited stock movement |
| 99 | Implemented | `InventoryTasksController.Tasks` → `IInventoryTaskService` |
| 100 | Implemented | `InventoryTasksController.CreateTask` → `IInventoryTaskService` |
| 101 | Implemented | `InventoryTasksController.UpdateTask` → state/assignment checks |
| 102 | Implemented | `FinanceController.Report` → revenue − expense |
| 103 | Contract missing | Weather provider, cache/staleness and failure contract unresolved |

## Totals

- Implemented: 94/103.
- Deferred: 6/103 (#4, #5, #8, #9, #12, #22).
- Contract missing: 3/103 (#89, #90, #103).

Supplemental normalized endpoints (registration, Zone access, inventory receipts/requirements/low-stock, finance CRUD, Service Request lifecycle, alert resolve, technician administration, IoT deployment workflow, and reports for inventory/tasks/maintenance) are tracked by their stable v1 IDs in `API_CATALOG.md`; they do not renumber the source 103.
