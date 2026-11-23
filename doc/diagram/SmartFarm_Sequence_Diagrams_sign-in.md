# Sign in

Source: `SmartFarm_R4_Sequence_Diagrams_Part2.drawio`.

```mermaid
flowchart LR
  title["Sign in"]
  source["SmartFarm  /  6c839e3  /  AuthController.cs · AuthService.LoginAsync"]
  actor_0["actor-0"]
  actor_label_0["User"]
  participant_1["«boundary»<br/>:LoginPage"]
  participant_2["«controller»<br/>:AuthController"]
  participant_3["«service»<br/>:AuthService"]
  participant_4["«persistence»<br/>:SmartFarmDbContext"]
  frame_0["frame-0"]
  tab_0["alt"]
  guard_0["[invalid credentials or unavailable account]"]
  otherwise_0["[preconditions satisfied]"]
  activation_0["activation-0"]
  activation_1["activation-1"]
  activation_2["activation-2"]
  activation_3["activation-3"]
  implementation_note["Failed attempts are counted and the account locks after the configured limit."]
```
