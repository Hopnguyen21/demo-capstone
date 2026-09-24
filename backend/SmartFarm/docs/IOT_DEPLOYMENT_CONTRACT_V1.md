# SmartFarm IoT Planning and Deployment Contract v1

This contract reconciles Flow 1 steps 14–30 with source API endpoints #54–#68. The source catalog starts at hardware provisioning and does not define measurement discovery, recommendation, Owner approval, Technician survey, deployment decisions, installation outcome, or maintenance handoff.

## Scope and authority

FarmOwner operates only inside the Tenant in the JWT. PlatformTechnician has no Tenant claim and may inspect or mutate a deployment only after accepting that request. Every nested operation validates Deployment Request → Zone → Field → Farm → Tenant and validates that referenced Gateway and Device belong to the same Farm.

Source endpoints #55 and #61 are tightened: `deploymentRequestId` is required and the supplied Farm must match the accepted request. A Technician cannot provision arbitrary hardware into a client-supplied Farm. Endpoint #64 additionally requires the Device to be part of the confirmed plan and in `Unassigned` state.

## Measurement discovery and recommendation

`GET /api/v1/zones/{zoneId}/iot-requirements` derives distinct parameter codes from the Zone's active Planting Season and its current applied requirements. It returns the Zone area, current stage and required measurements; it never accepts a client Tenant ID.

`POST /api/v1/zones/{zoneId}/device-recommendations` matches every required parameter against the system device-model catalog. Quantity is `ceiling(zoneAreaM2 / coverageAreaM2)`, with a minimum of one. A recommendation is rejected when any required parameter has no compatible model. Recommendations are planning data, not proof that physical inventory exists.

## Owner request lifecycle

| ID | Method | Path | Purpose |
| --- | --- | --- | --- |
| IOT-V1-01 | GET | `/api/v1/zones/{zoneId}/iot-requirements` | Resolve measurements from the active profile/stage |
| IOT-V1-02 | POST | `/api/v1/zones/{zoneId}/device-recommendations` | Propose compatible model and quantity |
| IOT-V1-03 | POST | `/api/v1/zones/{zoneId}/deployment-requests` | Create Owner draft from recommendation or adjusted items |
| IOT-V1-04 | PUT | `/api/v1/deployment-requests/{requestId}/plan` | Owner adjusts a Draft plan |
| IOT-V1-05 | POST | `/api/v1/deployment-requests/{requestId}/submit` | Submit a non-empty Draft |
| IOT-V1-06 | GET | `/api/v1/deployment-requests/{requestId}` | Owner or assigned Technician reads the workflow |

Only one non-terminal request (`Submitted`, `Accepted`, `Surveyed`, `PlanConfirmed`, `Installing`) may exist per Zone. Drafts do not block another draft, but only one draft may be submitted.

## Technician workflow

| ID | Method | Path | Purpose |
| --- | --- | --- | --- |
| IOT-V1-07 | GET | `/api/v1/platform/deployment-requests` | List unassigned Submitted requests and requests assigned to the Technician |
| IOT-V1-08 | POST | `/api/v1/platform/deployment-requests/{requestId}/accept` | Atomically accept a Submitted request |
| IOT-V1-09 | POST | `/api/v1/platform/deployment-requests/{requestId}/survey` | Record site conditions and feasibility |
| IOT-V1-10 | PUT | `/api/v1/platform/deployment-requests/{requestId}/plan` | Revise model, quantity and installation notes after survey |
| IOT-V1-11 | POST | `/api/v1/platform/deployment-requests/{requestId}/confirm` | Freeze the final feasible plan |
| IOT-V1-12 | POST | `/api/v1/platform/deployment-requests/{requestId}/installation/start` | Move the confirmed request to Installing |
| IOT-V1-13 | POST | `/api/v1/platform/deployment-requests/{requestId}/connection-tests` | Persist an observed Device connection test |
| IOT-V1-14 | POST | `/api/v1/platform/deployment-requests/{requestId}/complete` | Complete only when every planned Device is assigned and has a successful latest test |
| IOT-V1-15 | POST | `/api/v1/platform/deployment-requests/{requestId}/fail` | Record failure and create maintenance handoff |

Survey requires notes and an explicit feasibility decision. An infeasible survey cannot be confirmed until a later feasible survey exists. Every create, submit, accept, survey, plan adjustment, confirmation, installation, assignment, connection test, completion and failure appends an immutable decision-history row with UTC timestamp and actor.

## Hardware state and connection results

Gateways and Devices use source endpoints #54–#68. MQTT credentials and AES keys are not returned by this API slice; secret issuance belongs to the future gateway adapter. Firmware requests are recorded as jobs and do not claim successful OTA without device feedback.

Connection tests store `Succeeded`, RSSI, SNR, latency, observed time and optional error code/message. `GET /api/v1/devices/{deviceId}/ping` returns the latest stored test. It does not fabricate a live MQTT ACK while the transport adapter is absent.

Diagnostic endpoint #67 creates a durable asynchronous job in `Pending` state and returns HTTP 202. It does not report `Executed` until a future transport adapter records Device feedback.

A Device cannot be assigned twice, assigned across Farms, or assigned outside the accepted request Zone. Unassignment and decommission preserve assignment and test history.

## Failure and maintenance handoff

Failure sets the deployment to `MaintenanceRequired` and affected installed Devices to `MaintenanceRequired`. It creates one open `ServiceRequest` with source `DeploymentFailure`, preserving the failure code, description, request, Farm, Zone and Device links. This is an explicit handoff state for Flow 8; repair/replacement execution remains in the maintenance slice.
