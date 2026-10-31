namespace SmartFarm.Domain.Enums;

public enum MaterialType { Seed, Fertilizer, Pesticide, GrowingMedium, Tool, Other }
public enum InventoryMovementType { Receipt, Issue }
public enum LowStockAlertStatus { Open, Resolved }
/// <summary>Trạng thái của một phân công (từng Farmer) và trạng thái tổng hợp của công việc. Declined chỉ dùng cho phân công.</summary>
public enum FarmTaskStatus { Pending, Accepted, InProgress, CompletedPendingReview, Approved, Failed, Overdue, Cancelled, Declined }
public enum FarmTaskAction { Accept, Start, Complete, Fail, Approve, Reassign, Decline, UpdateProgress }
public enum FarmTaskEventType { Created, Accepted, Started, Completed, Approved, Failed, Overdue, Reassigned, AssigneeAdded, AssigneeRemoved, Declined, ProgressUpdated }
public enum FarmInvitationStatus { Pending, Accepted, Declined, Cancelled, Expired }
