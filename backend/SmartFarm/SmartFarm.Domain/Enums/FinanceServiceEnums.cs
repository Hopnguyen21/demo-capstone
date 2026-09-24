namespace SmartFarm.Domain.Enums;

public enum FinanceTransactionType { Revenue, Expense }
public enum ExpenseCategory { Material, Farmer, IoT, Maintenance, Other }
public enum ServiceResolutionAction { Maintenance, Repair, Replacement }
public enum ServiceHistoryEventType { Created, Assigned, Reassigned, Accepted, Diagnosed, WorkRecorded, Replaced, TestPassed, TestFailed, Closed }
