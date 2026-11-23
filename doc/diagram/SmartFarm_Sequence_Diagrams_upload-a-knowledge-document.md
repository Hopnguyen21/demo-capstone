# Upload a knowledge document

Source: `SmartFarm_R4_Sequence_Diagrams_Part2.drawio`.

```mermaid
flowchart LR
  title["Upload a knowledge document"]
  source["SmartFarm  /  6c839e3  /  AgricultureKnowledgeController.cs · AgricultureDocumentService.IngestDocumentAsync"]
  actor_0["actor-0"]
  actor_label_0["Platform Admin"]
  participant_1["«boundary»<br/>:VietGapStandardsPage"]
  participant_2["«controller»<br/>:AgricultureKnowledgeController"]
  participant_3["«service»<br/>:AgricultureDocumentService"]
  participant_4["«persistence»<br/>:SmartFarmDbContext"]
  frame_0["frame-0"]
  tab_0["alt"]
  guard_0["[invalid or duplicate document]"]
  otherwise_0["[preconditions satisfied]"]
  activation_0["activation-0"]
  activation_1["activation-1"]
  activation_2["activation-2"]
  activation_3["activation-3"]
```
