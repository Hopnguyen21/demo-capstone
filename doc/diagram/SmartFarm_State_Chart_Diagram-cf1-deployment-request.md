# CF1 - Deployment Request

Source: `SmartFarm_State_Chart_Diagram.drawio`.

```mermaid
flowchart LR
  cf1_title["DEPLOYMENT REQUEST STATE CHART"]
  cf1_active["ACTIVE DEPLOYMENT WORKFLOW"]
  cf1_start["cf1-start"]
  cf1_draft["Draft"]
  cf1_submitted["Submitted"]
  cf1_accepted["Accepted"]
  cf1_surveyed["Surveyed"]
  cf1_confirmed["PlanConfirmed"]
  cf1_installing["Installing"]
  JehCPXS8QSwiTSnhyVwq_1["Withdrawn"]
  cf1_maint["MaintenanceRequired"]
  cf1_completed["Completed"]
  E4GTX_sD2KJqrwQELuUy_1["E4GTX_sD2KJqrwQELuUy-1"]
  cf1_submitted --> JehCPXS8QSwiTSnhyVwq_1
  cf1_start --> |Owner creates plan| cf1_draft
  cf1_draft --> |Owner adjusts items| cf1_draft
  cf1_draft --> |submit [plan not empty]| cf1_submitted
  cf1_submitted --> |Technician accepts| cf1_accepted
  cf1_accepted --> |record site survey| cf1_surveyed
  cf1_surveyed --> |revise plan / repeat survey| cf1_surveyed
  cf1_surveyed --> |[latest survey feasible]| cf1_confirmed
  cf1_confirmed --> |start installation| cf1_installing
  cf1_installing --> |provision / assign / configure / test| cf1_installing
  cf1_maint --> E4GTX_sD2KJqrwQELuUy_1
  cf1_completed --> E4GTX_sD2KJqrwQELuUy_1
  cf1_installing --> |[all devices assigned & latest tests succeed]| cf1_completed
```
