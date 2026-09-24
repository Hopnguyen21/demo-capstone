namespace SmartFarm.Domain.Enums;

public enum MaterialType { Seed, Fertilizer, Pesticide, GrowingMedium, Tool, Other }
public enum InventoryMovementType { Receipt, Issue }
public enum LowStockAlertStatus { Open, Resolved }
public enum FarmTaskStatus { Pending, Accepted, InProgress, CompletedPendingReview, Approved, Failed, Overdue, Cancelled }
public enum FarmTaskAction { Accept, Start, Complete, Fail, Approve, Reassign }
public enum FarmTaskEventType { Created, Accepted, Started, Completed, Approved, Failed, Overdue, Reassigned }
