namespace SmartFarm.Domain.Enums;

public enum DeploymentRequestStatus { Draft, Submitted, Accepted, Surveyed, PlanConfirmed, Installing, Completed, MaintenanceRequired }
public enum DeviceType { SensorNode, ActuatorNode }
public enum DeviceStatus { Unassigned, Assigned, SensorsConfigured, ActuatorsConfigured, Online, Offline, MaintenanceRequired, Decommissioned }
public enum GatewayStatus { Provisioned, Online, Offline }
public enum FirmwareJobStatus { Scheduled, InProgress, Succeeded, Failed }
public enum DiagnosticJobStatus { Pending, Sent, Acknowledged, Failed, TimedOut, Cancelled }
public enum ServiceRequestStatus { Open, Assigned, InProgress, Resolved, Closed }
public enum AlertSeverity { Info, Warning, Critical }
public enum AlertStatus { Open, Acknowledged, Resolved }
public enum AlertEventType { Created, Acknowledged, Resolved }
