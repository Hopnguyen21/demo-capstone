# Read latest Zone telemetry

Source: `SmartFarm_R4_Sequence_Diagrams_Part2.drawio`.

```mermaid
flowchart LR
  title["Read latest Zone telemetry"]
  source["SmartFarm  /  6c839e3  /  TelemetryAlertsController.cs · TelemetryAlertService.LatestAsync"]
  actor_0["actor-0"]
  actor_label_0["Farm Owner"]
  participant_1["«boundary»<br/>:MonitoringRealtime"]
  participant_2["«controller»<br/>:TelemetryController"]
  participant_3["«service»<br/>:TelemetryAlertService"]
  participant_4["«persistence»<br/>:SmartFarmDbContext"]
  frame_0["frame-0"]
  tab_0["alt"]
  guard_0["[resource is out of scope]"]
  otherwise_0["[preconditions satisfied]"]
  activation_0["activation-0"]
  activation_1["activation-1"]
  activation_2["activation-2"]
  activation_3["activation-3"]
```
