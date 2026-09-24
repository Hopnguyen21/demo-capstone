namespace SmartFarm.Domain.Enums;

public enum ActuatorCommandStatus { Pending, Sent, Acknowledged, Failed, TimedOut, Cancelled }
public enum ActuatorCommandAction { TurnOn, TurnOff }
public enum CommandTriggerSource { Manual, Schedule, AutoRule, AiApproved }
public enum CommandEventKind { Created, Published, Feedback, CancellationRequested, TransportFailure, Timeout, LateFeedback }
public enum AutoRuleOperator { LessThan, LessThanOrEqual, GreaterThan, GreaterThanOrEqual }
