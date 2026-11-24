# CF4 - AI Advisory

Source: `SmartFarm_State_Chart_Diagram.drawio`.

```mermaid
flowchart LR
  cf4_title["AI ADVISORY STATE CHART"]
  cf4_consult["AI CONSULTATION"]
  cf4_cstart["cf4-cstart"]
  cf4_pending["Pending"]
  cf4_completed["Completed"]
  cf4_limited["Limited"]
  cf4_failed["Failed"]
  _jNSRiQfnKfL5wEpBuVv_2["_jNSRiQfnKfL5wEpBuVv-2"]
  cf4_rec["AI RECOMMENDATION"]
  cf4_rstart["cf4-rstart"]
  cf4_classify["cf4-classify"]
  cf4_ready["Ready"]
  cf4_insufficient["InsufficientData"]
  cf4_low["LowConfidence"]
  cf4_unavailable["ProviderUnavailable"]
  cf4_invalid["InvalidProviderOutput"]
  cf4_accepted["Accepted"]
  cf4_rejected["Rejected"]
  cf4_ignored["Ignored"]
  cf4_superseded["Superseded"]
  _jNSRiQfnKfL5wEpBuVv_7["_jNSRiQfnKfL5wEpBuVv-7"]
  _jNSRiQfnKfL5wEpBuVv_6["_jNSRiQfnKfL5wEpBuVv-6"]
  cf4_cstart --> |user asks| cf4_pending
  cf4_pending --> |provider returns usable result| cf4_completed
  cf4_pending --> |missing / uncertain context or fallback| cf4_limited
  cf4_pending --> |processing failure| cf4_failed
  cf4_completed --> _jNSRiQfnKfL5wEpBuVv_2
  cf4_limited --> _jNSRiQfnKfL5wEpBuVv_2
  cf4_failed --> _jNSRiQfnKfL5wEpBuVv_2
  cf4_rstart --> |classify outcome| cf4_classify
  cf4_classify --> |[actionable & sufficiently confident]| cf4_ready
  cf4_classify --> |[context incomplete]| cf4_insufficient
  cf4_classify --> |[confidence below policy]| cf4_low
  cf4_classify --> |[provider unavailable]| cf4_unavailable
  cf4_classify --> |[schema / safety validation fails]| cf4_invalid
  cf4_ready --> |Owner accepts while valid| cf4_accepted
  cf4_ready --> |Owner rejects| cf4_rejected
  cf4_ready --> |Owner ignores| cf4_ignored
  cf4_ready --> |newer recommendation replaces it| cf4_superseded
  cf4_insufficient --> |later consultation| cf4_superseded
  cf4_low --> |later consultation| cf4_superseded
  cf4_rejected --> _jNSRiQfnKfL5wEpBuVv_7
  cf4_superseded --> _jNSRiQfnKfL5wEpBuVv_7
  cf4_unavailable --> _jNSRiQfnKfL5wEpBuVv_6
  cf4_invalid --> _jNSRiQfnKfL5wEpBuVv_7
  cf4_ignored --> _jNSRiQfnKfL5wEpBuVv_6
  cf4_accepted --> |create AI_APPROVED command| _jNSRiQfnKfL5wEpBuVv_6
```
