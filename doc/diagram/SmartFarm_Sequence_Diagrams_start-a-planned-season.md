# Start a planned season

Source: `SmartFarm_R4_Sequence_Diagrams_Part2.drawio`.

```mermaid
flowchart LR
  title["Start a planned season"]
  source["SmartFarm  /  6c839e3  /  CropGrowthController.cs · CropGrowthService.StartSeasonAsync"]
  actor_0["actor-0"]
  actor_label_0["Farm Owner"]
  participant_1["«boundary»<br/>:ZoneSeasonsSection"]
  participant_2["«controller»<br/>:CropGrowthController"]
  participant_3["«service»<br/>:CropGrowthService"]
  participant_4["«persistence»<br/>:SmartFarmDbContext"]
  frame_0["frame-0"]
  tab_0["alt"]
  guard_0["[current season or profile conflict]"]
  otherwise_0["[preconditions satisfied]"]
  activation_0["activation-0"]
  activation_1["activation-1"]
  activation_2["activation-2"]
  activation_3["activation-3"]
  implementation_note["Only a Planned season can be started; the stage requirements are copied to the season."]
```
