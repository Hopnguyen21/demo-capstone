# Create a Zone

Source: `SmartFarm_R4_Sequence_Diagrams_Part2.drawio`.

```mermaid
flowchart LR
  title["Create a Zone"]
  source["SmartFarm  /  6c839e3  /  ZonesController.cs · FarmStructureService.CreateAsync"]
  actor_0["actor-0"]
  actor_label_0["Farm Owner"]
  participant_1["«boundary»<br/>:ZonesPage"]
  participant_2["«controller»<br/>:ZonesController"]
  participant_3["«service»<br/>:FarmStructureService"]
  participant_4["«persistence»<br/>:SmartFarmDbContext"]
  frame_0["frame-0"]
  tab_0["alt"]
  guard_0["[invalid polygon or overlapping Zone]"]
  otherwise_0["[preconditions satisfied]"]
  activation_0["activation-0"]
  activation_1["activation-1"]
  activation_2["activation-2"]
  activation_3["activation-3"]
```
