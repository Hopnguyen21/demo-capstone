# CF4 - AI Advisory

Source: `SmartFarm_Activity_Swimlane_Diagram.drawio`.

```mermaid
flowchart LR
  n_7LfwCi4g9imtkzgbm6t8_1["AI ADVISORY & DECISION SUPPORT"]
  n_7LfwCi4g9imtkzgbm6t8_2["FARM OWNER"]
  n_7LfwCi4g9imtkzgbm6t8_8["See rejection reason"]
  n_7LfwCi4g9imtkzgbm6t8_9["7LfwCi4g9imtkzgbm6t8-9"]
  n_7LfwCi4g9imtkzgbm6t8_11["Decision"]
  n_7LfwCi4g9imtkzgbm6t8_10["Read cited answer, limits & proposed action"]
  n_7LfwCi4g9imtkzgbm6t8_3["WEATHER + AI PROVIDERS"]
  n_7LfwCi4g9imtkzgbm6t8_4["SMARTFARM PLATFORM"]
  n_7LfwCi4g9imtkzgbm6t8_5["Persist consultation & Ready recommendation"]
  n_7LfwCi4g9imtkzgbm6t8_14["Authorize Farm Owner of Tenant & Zone"]
  n_7LfwCi4g9imtkzgbm6t8_15["Question allowed?"]
  n_7LfwCi4g9imtkzgbm6t8_16["Build context: Farm, Season, Crop, Stage, telemetry"]
  n_7LfwCi4g9imtkzgbm6t8_17["Retrieve approved VietGAP passages (pgvector)"]
  n_7LfwCi4g9imtkzgbm6t8_18["Required data and source available?"]
  n_7LfwCi4g9imtkzgbm6t8_19["Valid, confident output?"]
  n_7LfwCi4g9imtkzgbm6t8_21["Persist Rejected or Ignored decision"]
  n_7LfwCi4g9imtkzgbm6t8_6["7LfwCi4g9imtkzgbm6t8-6"]
  n_7LfwCi4g9imtkzgbm6t8_7["Ask a Zone-scoped question"]
  n_7LfwCi4g9imtkzgbm6t8_12["Return weather context"]
  n_7LfwCi4g9imtkzgbm6t8_13["Generate structured answer"]
  n_7LfwCi4g9imtkzgbm6t8_20["Persist Limited consultation"]
  n_7LfwCi4g9imtkzgbm6t8_23["Mark Superseded; create follow-up request"]
  n_7LfwCi4g9imtkzgbm6t8_24["Revalidate: Ready, actionable, confident, not expired\\\\\\\\\\"]
  n_7LfwCi4g9imtkzgbm6t8_25["Still valid?"]
  n_7LfwCi4g9imtkzgbm6t8_26["Create AI_APPROVED Pending command"]
  n_7LfwCi4g9imtkzgbm6t8_28["Return conflict (409); nothing executed"]
  n_7LfwCi4g9imtkzgbm6t8_29["7LfwCi4g9imtkzgbm6t8-29"]
  n_7LfwCi4g9imtkzgbm6t8_8 --> n_7LfwCi4g9imtkzgbm6t8_9
  n_7LfwCi4g9imtkzgbm6t8_10 --> n_7LfwCi4g9imtkzgbm6t8_11
  n_7LfwCi4g9imtkzgbm6t8_14 --> n_7LfwCi4g9imtkzgbm6t8_15
  n_7LfwCi4g9imtkzgbm6t8_15 --> |[Yes]| n_7LfwCi4g9imtkzgbm6t8_16
  n_7LfwCi4g9imtkzgbm6t8_16 --> n_7LfwCi4g9imtkzgbm6t8_17
  n_7LfwCi4g9imtkzgbm6t8_17 --> n_7LfwCi4g9imtkzgbm6t8_18
  n_7LfwCi4g9imtkzgbm6t8_19 --> |[Yes]| n_7LfwCi4g9imtkzgbm6t8_5
  n_7LfwCi4g9imtkzgbm6t8_6 --> n_7LfwCi4g9imtkzgbm6t8_7
  n_7LfwCi4g9imtkzgbm6t8_7 --> n_7LfwCi4g9imtkzgbm6t8_14
  n_7LfwCi4g9imtkzgbm6t8_15 --> |[No]| n_7LfwCi4g9imtkzgbm6t8_8
  n_7LfwCi4g9imtkzgbm6t8_16 --> n_7LfwCi4g9imtkzgbm6t8_12
  n_7LfwCi4g9imtkzgbm6t8_12 --> n_7LfwCi4g9imtkzgbm6t8_17
  n_7LfwCi4g9imtkzgbm6t8_18 --> |[Yes]| n_7LfwCi4g9imtkzgbm6t8_13
  n_7LfwCi4g9imtkzgbm6t8_18 --> |[No]| n_7LfwCi4g9imtkzgbm6t8_20
  n_7LfwCi4g9imtkzgbm6t8_13 --> n_7LfwCi4g9imtkzgbm6t8_19
  n_7LfwCi4g9imtkzgbm6t8_19 --> |[No]| n_7LfwCi4g9imtkzgbm6t8_20
  n_7LfwCi4g9imtkzgbm6t8_5 --> n_7LfwCi4g9imtkzgbm6t8_10
  n_7LfwCi4g9imtkzgbm6t8_20 --> n_7LfwCi4g9imtkzgbm6t8_10
  n_7LfwCi4g9imtkzgbm6t8_11 --> |[Reject or Ignore]| n_7LfwCi4g9imtkzgbm6t8_21
  n_7LfwCi4g9imtkzgbm6t8_21 --> n_7LfwCi4g9imtkzgbm6t8_29
  n_7LfwCi4g9imtkzgbm6t8_11 --> |[Accept]| n_7LfwCi4g9imtkzgbm6t8_24
  n_7LfwCi4g9imtkzgbm6t8_24 --> n_7LfwCi4g9imtkzgbm6t8_25
  n_7LfwCi4g9imtkzgbm6t8_25 --> |[Yes]| n_7LfwCi4g9imtkzgbm6t8_26
  n_7LfwCi4g9imtkzgbm6t8_25 --> |[No]| n_7LfwCi4g9imtkzgbm6t8_28
  n_7LfwCi4g9imtkzgbm6t8_28 --> n_7LfwCi4g9imtkzgbm6t8_29
  n_7LfwCi4g9imtkzgbm6t8_26 --> n_7LfwCi4g9imtkzgbm6t8_29
  n_7LfwCi4g9imtkzgbm6t8_11 --> |[More analysis]| n_7LfwCi4g9imtkzgbm6t8_23
  n_7LfwCi4g9imtkzgbm6t8_23 --> n_7LfwCi4g9imtkzgbm6t8_15
```
