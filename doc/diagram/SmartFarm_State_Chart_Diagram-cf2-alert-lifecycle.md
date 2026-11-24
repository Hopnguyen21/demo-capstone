# CF2 - Alert Lifecycle

Source: `SmartFarm_State_Chart_Diagram.drawio`.

```mermaid
flowchart LR
  cf2_title["ALERT STATE CHART"]
  cf2_start["cf2-start"]
  cf2_open["Open"]
  cf2_ack["Acknowledged"]
  cf2_resolved["Resolved"]
  cf2_end["cf2-end"]
  cf2_endb["cf2-endb"]
  cf2_start --> |[two consecutive violations & cooldown permits]| cf2_open
  cf2_open --> |acknowledge / Owner or assigned Farmer| cf2_ack
  cf2_open --> |corrective action recorded| cf2_resolved
  cf2_ack --> |corrective action recorded| cf2_resolved
  cf2_resolved --> cf2_end
```
