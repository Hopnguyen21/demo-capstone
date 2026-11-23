# Record Owner Decision on AI Advice

Source: `02-sequence-diagrams-v2.drawio`.

```mermaid
flowchart LR
  title["Record Owner Decision on AI Advice"]
  source["SmartFarm  /  6c839e3  /  AiAdvisoryService.DecideAsync · ControlService.cs"]
  actor_0["actor-0"]
  actor_label_0["FarmOwner"]
  participant_1["«boundary»<br/>:AIAssistantPage"]
  participant_2["«controller»<br/>:AiAdvisoryController"]
  participant_3["«service»<br/>:AiAdvisoryService"]
  participant_4["«persistence»<br/>:SmartFarmDbContext"]
  participant_5["«service»<br/>:ControlService"]
  participant_6["«transport»<br/>:IActuatorCommandTransport"]
  frame_safety["frame-safety"]
  tab_safety["alt"]
  guard_safety["[safety check fails]"]
  frame_decision["frame-decision"]
  tab_decision["alt"]
  guard_decision["[recommendation missing]"]
  activation_0["activation-0"]
  activation_1["activation-1"]
  activation_2["activation-2"]
  activation_3["activation-3"]
  activation_4["activation-4"]
  activation_5["activation-5"]
  otherwise_507["[decision already recorded]"]
  otherwise_629["[accepted]"]
  otherwise_788["[safety checks pass]"]
  otherwise_1150["[rejected or ignored]"]
  otherwise_1315["[more analysis requested]"]
  self_note_24["24: AskInternalAsync(...)"]
  implementation_note["Validation includes a required decision, a reason for rejection and a valid follow-up question when requesting more analysis; that branch also enforces the AI rate limit (429)."]
```
