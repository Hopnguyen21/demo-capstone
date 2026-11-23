# Assign and approve a farm task

Source: `SmartFarm_R4_Sequence_Diagrams_Part2.drawio`.

```mermaid
flowchart LR
  title["Assign and approve a farm task"]
  source["SmartFarm  /  6c839e3  /  InventoryTasksController.cs · InventoryTaskService.CreateTaskAsync · UpdateTaskAsync"]
  actor_0["actor-0"]
  actor_label_0["Farm Owner"]
  participant_1["«boundary»<br/>:TasksPage"]
  participant_2["«controller»<br/>:InventoryTasksController"]
  participant_3["«service»<br/>:InventoryTaskService"]
  participant_4["«persistence»<br/>:SmartFarmDbContext"]
  participant_5["«boundary»<br/>:FarmerTasksPage"]
  actor_6["actor-6"]
  actor_label_6["Farmer"]
  frame_0["frame-0"]
  tab_0["alt"]
  guard_0["[assignee lacks eligible Farm or Zone access]"]
  otherwise_0["[preconditions satisfied]"]
  activation_0["activation-0"]
  activation_1["activation-1"]
  activation_2["activation-2"]
  activation_3["activation-3"]
  implementation_note["Each assigned Farmer updates only their own assignment; the Owner approves each result."]
```
