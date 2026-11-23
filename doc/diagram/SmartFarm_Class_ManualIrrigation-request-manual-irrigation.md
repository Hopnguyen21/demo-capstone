# Request Manual Irrigation

Source: `SmartFarm_R4_Class_ManualIrrigation.drawio`.

```mermaid
flowchart LR
  ctl["ControlController"]
  ctl_f["- service: IControlService"]
  ctl_m["+ Command(zoneId: Guid, actuatorId: Guid, request: ManualControlRequest, ct): ActionResult"]
  dto1["«DTO»<br/>ManualControlRequest"]
  dto1_f["+ Action: ActuatorCommandAction<br/>+ DurationSeconds: int<br/>+ OverrideActiveSchedules: bool<br/>+ IdempotencyKey: string<br/>+ Notes: string?"]
  dto1_m["~ ToCommand(): ManualCommandRequest"]
  isvc["«interface»<br/>IControlService"]
  isvc_f["isvc_f"]
  isvc_m["+ CreateManualCommandAsync(userId, tenantId, zoneId, actuatorId, request: ManualCommandRequest, ct): Task"]
  dto2["«record»<br/>ManualCommandRequest"]
  dto2_f["+ Action: ActuatorCommandAction<br/>+ DurationSeconds: int<br/>+ OverrideActiveSchedules: bool<br/>+ IdempotencyKey: string<br/>+ Notes: string?"]
  dto2_m["dto2_m"]
  svc["ControlService"]
  svc_f["- db: SmartFarmDbContext<br/>- transport: IActuatorCommandTransport<br/>- rain: IRainForecastProvider<br/>- clock: TimeProvider"]
  svc_m["+ CreateManualCommandAsync(...): Task<br/>- EnsureZoneControlAsync(userId, tenantId, zoneId, ct)<br/>- EnsureReadyAsync(deviceId, ct)<br/>- EnsureRainAsync(actuator, enabled, threshold, action, ct)<br/>- DispatchAsync(command, ct)"]
  itr["«interface»<br/>IActuatorCommandTransport"]
  itr_f["itr_f"]
  itr_m["+ PublishAsync(command: CommandDispatchEnvelope, ct): Task<br/>+ PublishEmergencyStopAsync(command, ct): Task"]
  irain["«interface»<br/>IRainForecastProvider"]
  irain_f["irain_f"]
  irain_m["+ GetAsync(farmId: Guid, ct): Task"]
  mqtt["MqttBrokerHost"]
  mqtt_f["- connectedClients: ConcurrentDictionary"]
  mqtt_m["+ PublishAsync(command, ct)<br/>+ PublishEmergencyStopAsync(command, ct)"]
  rainimpl["UnavailableRainForecastProvider"]
  rainimpl_f["- serviceProvider: IServiceProvider"]
  rainimpl_m["+ GetAsync(farmId, ct): Task"]
  db["SmartFarmDbContext"]
  db_f["+ ActuatorCommands: DbSet<br/>+ ActuatorCommandEvents: DbSet"]
  db_m["+ SaveChangesAsync(ct): Task"]
  ent["«entity»<br/>ActuatorCommand"]
  ent_f["+ ZoneId: Guid<br/>+ ActuatorId: Guid<br/>+ IdempotencyKey: string<br/>+ Action: ActuatorCommandAction<br/>+ DurationSeconds: int<br/>+ Status: ActuatorCommandStatus<br/>+ AckDeadlineAtUtc: DateTime?"]
  ent_m["ent_m"]
  title["Class Diagram - Request Manual Irrigation"]
  ctl --> |service| isvc
  ctl --> |uses (parameter)| dto1
  dto1 --> |creates| dto2
  svc --> isvc
  svc --> |uses (parameter)| dto2
  svc --> |transport| itr
  svc --> |rain| irain
  svc --> |db| db
  svc --> |creates| ent
  mqtt --> itr
  rainimpl --> irain
  db --> |ActuatorCommands 0..*| ent
```
