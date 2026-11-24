# Create a Zone contract

Source: `SmartFarm_R4_Sequence_Diagrams_Part2.drawio`.

```mermaid
flowchart LR
  title["Create a Zone contract"]
  source["SmartFarm  /  6c839e3  /  ZoneContractsController.cs · ZoneContractService.CreateContractAsync"]
  actor_0["actor-0"]
  actor_label_0["Farm Owner"]
  participant_1["«boundary»<br/>:ZoneContractCreateModal"]
  participant_2["«controller»<br/>:ZoneContractsController"]
  participant_3["«service»<br/>:ZoneContractService"]
  participant_4["«persistence»<br/>:SmartFarmDbContext"]
  frame_0["frame-0"]
  tab_0["alt"]
  guard_0["[invalid terms or overlapping contract]"]
  otherwise_0["[preconditions satisfied]"]
  activation_0["activation-0"]
  activation_1["activation-1"]
  activation_2["activation-2"]
  activation_3["activation-3"]
```
