# CF2 - Monitoring & Alerts

Source: `SmartFarm_Activity_Swimlane_Diagram.drawio`.

```mermaid
flowchart LR
  cf2_title["ENVIRONMENT MONITORING & ALERTS"]
  cf2_l1["IoT EDGE"]
  cf2_e1n["Sensor captures measurement"]
  cf2_e2n["Node sends LoRa frame"]
  cf2_e3n["Gateway publishes authenticated MQTT envelope"]
  cf2_l2["SMARTFARM PLATFORM"]
  cf2_p4["Update anti-flap state"]
  cf2_d2["Violation reaches threshold &<br/>cooldown permits?"]
  cf2_p6["Update dashboard"]
  cf2_p5["Create Alert & history event"]
  cf2_p7["Append acknowledge / resolve history"]
  cf2_p1["Validate gateway identity, topic & payload"]
  cf2_p2["Persist telemetry with Tenant / Farm / Zone context"]
  cf2_p3["Load active Season, Growth Stage & thresholds"]
  hqIh0Qa8DWQxzApr7prP_1["hqIh0Qa8DWQxzApr7prP-1"]
  G24cWXgbMB_f6hJJUrRJ_1["Update latest / history / dashboard"]
  cf2_l3["OWNER / FARMER"]
  cf2_u1["View dashboard & alert"]
  cf2_u2["Acknowledge alert"]
  cf2_u3["Perform corrective action"]
  cf2_u4["Resolve with action & notes"]
  cf2_start["cf2-start"]
  cf2_d1["Duplicate message / reading?"]
  cf2_e1n --> cf2_e2n
  cf2_e2n --> cf2_e3n
  cf2_p4 --> cf2_d2
  cf2_d2 --> |No| cf2_p6
  cf2_d2 --> |Yes| cf2_p5
  cf2_p5 --> G24cWXgbMB_f6hJJUrRJ_1
  cf2_p7 --> hqIh0Qa8DWQxzApr7prP_1
  cf2_p2 --> cf2_p3
  cf2_p3 --> cf2_p4
  cf2_p6 --> hqIh0Qa8DWQxzApr7prP_1
  cf2_u1 --> cf2_u2
  cf2_u2 --> cf2_u3
  cf2_u3 --> cf2_u4
  cf2_start --> cf2_e1n
  cf2_e3n --> cf2_p1
  cf2_p1 --> cf2_d1
  cf2_d1 --> |No| cf2_p2
  cf2_d1 --> |Yes (ignore duplicate)| cf2_p6
  cf2_u4 --> cf2_p7
  G24cWXgbMB_f6hJJUrRJ_1 --> cf2_u1
```
