# Class Diagram - Issue Inventory

Source: `SmartFarm_R4_Class_Inventory.drawio`.

```mermaid
flowchart LR
  ctl["InventoryTasksController"]
  ctl_f["- service: IInventoryTaskService"]
  ctl_m["+ Issue(farmId: Guid, r: IssueInventoryRequest, ct): ActionResult"]
  req["«DTO»<br/>IssueInventoryRequest"]
  req_f["+ InventoryItemId: Guid<br/>+ Quantity: decimal<br/>+ ZoneId: Guid<br/>+ TaskId: Guid?"]
  req_m["req_m"]
  isvc["«interface»<br/>IInventoryTaskService"]
  isvc_f["isvc_f"]
  isvc_m["+ IssueAsync(userId, tenantId, farmId, command: IssueInventoryCommand, ct): Task"]
  cmd["«record»<br/>IssueInventoryCommand"]
  cmd_f["+ InventoryItemId: Guid<br/>+ Quantity: decimal<br/>+ ZoneId: Guid<br/>+ TaskId: Guid?<br/>+ Notes: string?"]
  cmd_m["cmd_m"]
  svc["InventoryTaskService"]
  svc_f["- db: SmartFarmDbContext"]
  svc_m["+ IssueAsync(...): Task"]
  db["SmartFarmDbContext"]
  db_f["+ InventoryItems: DbSet<br/>+ InventoryTransactions: DbSet<br/>+ LowStockAlerts: DbSet"]
  db_m["+ SaveChangesAsync(ct): Task"]
  item["«entity»<br/>InventoryItem"]
  item_f["+ Name: string<br/>+ MaterialType: MaterialType<br/>+ Unit: string<br/>+ QuantityOnHand: decimal<br/>+ LowStockThreshold: decimal"]
  item_m["item_m"]
  tx["«entity»<br/>InventoryTransaction"]
  tx_f["+ InventoryItemId: Guid<br/>+ MovementType: string<br/>+ Quantity: decimal<br/>+ BalanceAfter: decimal<br/>+ ZoneId: Guid?<br/>+ FarmTaskId: Guid?"]
  tx_m["tx_m"]
  la["«entity»<br/>LowStockAlert"]
  la_f["+ InventoryItemId: Guid<br/>+ Status: string<br/>+ QuantityAtOpen: decimal<br/>+ OpenedAtUtc: DateTime<br/>+ ResolvedAtUtc: DateTime?"]
  la_m["la_m"]
  title["Class Diagram - Issue Inventory"]
  ctl --> |service| isvc
  ctl --> |uses (parameter)| req
  isvc --> |uses (parameter)| cmd
  svc --> isvc
  svc --> |db| db
  db --> |InventoryItems 0..*| item
  db --> |InventoryTransactions 0..*| tx
  db --> |LowStockAlerts 0..*| la
  tx --> |Item 1| item
  la --> |Item 1| item
```
