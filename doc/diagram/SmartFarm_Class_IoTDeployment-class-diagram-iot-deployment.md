# Class Diagram - IoT Deployment

Source: `SmartFarm_R4_Class_IoTDeployment.drawio`.

```mermaid
flowchart LR
  c1["IoTPlanningController"]
  c1_f["- service: IIoTDeploymentService"]
  c1_m["+ SubmitDirect(zoneId: Guid, body: SubmitDeploymentRequestCommand, ct): ActionResult"]
  c2["TechnicianDeploymentController"]
  c2_f["- service: IIoTDeploymentService"]
  c2_m["+ Accept(requestId: Guid, ct): ActionResult<br/>+ Start(requestId: Guid, ct): ActionResult"]
  cmd["«record»<br/>SubmitDeploymentRequestCommand"]
  cmd_f["+ OwnerNotes: string?<br/>+ EstimateItems: IReadOnlyList?"]
  cmd_m["cmd_m"]
  isvc["«interface»<br/>IIoTDeploymentService"]
  isvc_f["isvc_f"]
  isvc_m["+ SubmitWithEstimateAsync(ownerId, tenantId, zoneId, command, ct)<br/>+ AcceptAsync(technicianId, requestId, ct)<br/>+ StartInstallationAsync(technicianId, requestId, ct)<br/>+ CompleteAsync(technicianId, requestId, ct)"]
  svc["IoTDeploymentService"]
  svc_f["- db: SmartFarmDbContext"]
  svc_m["+ SubmitWithEstimateAsync(...): Task<br/>+ AcceptAsync(...): Task<br/>+ StartInstallationAsync(...): Task<br/>+ CompleteAsync(...): Task"]
  db["SmartFarmDbContext"]
  db_f["+ DeploymentRequests: DbSet"]
  db_m["+ SaveChangesAsync(ct): Task"]
  dr["«entity»<br/>DeploymentRequest"]
  dr_f["+ TenantId: Guid<br/>+ ZoneId: Guid<br/>+ PlantingSeasonId: Guid<br/>+ OwnerUserId: Guid<br/>+ TechnicianUserId: Guid?<br/>+ Status: string<br/>+ SubmittedAtUtc: DateTime?<br/>+ CompletedAtUtc: DateTime?"]
  dr_m["dr_m"]
  title["Class Diagram - IoT Deployment"]
  c1 --> |service| isvc
  c2 --> |service| isvc
  c1 --> |uses (parameter)| cmd
  svc --> isvc
  svc --> |db| db
  db --> |DeploymentRequests 0..*| dr
```
