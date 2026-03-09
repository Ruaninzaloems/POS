# Full Debt & Legal Architecture Specification

## Hybrid Architecture

Replit is the UI, rules engine, and process orchestrator.
Platinum remains the system of record through APIs only.
Azure Service Bus must be used only for long-running, heavy, retryable background jobs.
Normal lookups and screen reads must stay synchronous API calls.
No Replit database for feature data.
No fallback data.
No mock responses in live flows.

## Architecture Rules

### Use Direct APIs For:
- Configuration reads and saves
- Dropdowns and lookups
- Enquiry screens
- Run lists
- Account lists
- Handover lists
- Reports and downloads
- Normal status reads

### Use Azure Service Bus For:
- Section 129 trial run processing
- Section 129 final run processing
- 14-workday lapse processing
- Handover batch processing
- Handover termination processing
- Bulk notice generation
- SMS/email/print batch generation
- Retryable communication failures
- Dashboard event updates where background processing is required

## Processing Pattern

For every long-running process, use this pattern:

1. Replit API receives the user request
2. Validate input and permissions
3. Save the process request header and audit entry via Platinum API
4. Publish a message to Azure Service Bus
5. Background worker picks up the message
6. Worker executes rules and processing
7. Worker writes all results back to Platinum through APIs
8. Worker updates status, audit, files, and errors
9. Replit UI polls or refreshes job status

## Anti-Patterns

- Do not run heavy trial/final/handover processing inside the browser
- Do not wait for long-running HTTP requests to finish in the UI
- Do not calculate legal results only in frontend state
- Do not update Platinum directly without audit metadata
- Do not use Service Bus for simple dropdowns or screen loads

## Core Modules

1. **Configuration module** — Financial year config, template assignment, cost items, attorney rotation
2. **Rule engine** — Qualification rules, scoring, exclusion logic
3. **Trial review module** — Account selection/deselection before final run
4. **Trial run module** — Identify qualifying accounts (background via Service Bus)
5. **Authorisation module** — Approve/reject trial results before final execution
6. **Final run module** — Execute approved notices (background via Service Bus)
7. **Lapse tracker** — 14-workday lapse monitoring (background via Service Bus)
8. **Handover module** — Account/Bulk/Rotation handover to attorneys (background via Service Bus)
9. **Handover termination module** — Terminate handovers with audit (background via Service Bus)
10. **General enquiries module** — Account lookup, debt tabs, history
11. **Reports and file module** — Generated files tracking and download
12. **Audit and dashboard module** — Full audit trail, status tracking, dashboard metrics

## Business Rules

- Only one enabled Section 129 config per financial year
- Lapse days are workdays (exclude weekends and public holidays)
- Support Account, Bulk, and Rotation handover modes
- Exclude handed-over accounts from Section 129 processing
- Ignore RPP (Rates Payment Plan) balances
- Exclude accounts with active clearances
- Final run must use approved trial data only
- All handover and termination actions must be auditable
- All generated files must be tracked and downloadable
- All write actions must store user and timestamp details

## Audit Requirements

Every write action must persist:

| Field | When |
|-------|------|
| CapturerID | Always |
| DateCaptured | Always |
| ModifierID | Always |
| DateModified | Always |
| ReviewerID | Where applicable (authorization, review steps) |
| ReviewDate | Where applicable |
| StatusID | Always |
| Comment / Notes | Where applicable |
| RunID | Section 129 runs |
| AccountID | Account-level operations |
| HandoverID | Handover operations |

## Azure Service Bus Message Types

### Command Messages (Trigger Processing)

| Message Type | Purpose |
|-------------|---------|
| StartSection129TrialRun | Initiate trial run to identify qualifying accounts |
| SubmitSection129TrialReview | Submit reviewed/selected accounts |
| AuthorizeSection129Run | Authorize approved trial for final execution |
| StartSection129FinalRun | Execute final notice generation |
| ProcessLapseCheck | Run 14-workday lapse check |
| StartHandoverSubmit | Submit accounts for attorney handover |
| StartHandoverTerminate | Terminate handover for accounts |
| GenerateRunFiles | Generate PDF/print files for a run |
| RetryCommunicationBatch | Retry failed SMS/email/print batch |

### Event Messages (Completion Notifications)

| Message Type | Purpose |
|-------------|---------|
| Section129TrialRunCompleted | Trial run finished processing |
| Section129FinalRunCompleted | Final run finished processing |
| HandoverCompleted | Handover batch finished |
| HandoverTerminationCompleted | Termination batch finished |
| CommunicationBatchFailed | Communication batch failed (trigger retry) |

## Deliverables Required Before Deep Coding

1. **Final architecture diagram** — System components, data flow, API/Service Bus boundaries
2. **API list** — Every endpoint with method, path, auth, request/response schema
3. **Service Bus queue/topic design** — Queue names, message schemas, DLQ strategy
4. **Worker process design** — Worker responsibilities, scaling, error handling
5. **Table-to-process mapping** — Which tables support which processes
6. **Status matrix** — All status values for runs, handovers, terminations
7. **Audit matrix** — Which actions write which audit fields
8. **Error/retry strategy** — Retry counts, backoff, DLQ handling, alerting
9. **Requirement compliance checklist** — Every business rule mapped to implementation

## Status Flow Examples

### Section 129 Run Status Flow
```
DRAFT → TRIAL_RUNNING → TRIAL_COMPLETE → UNDER_REVIEW → APPROVED → FINAL_RUNNING → FINAL_COMPLETE → LAPSING → LAPSED
```

### Handover Status Flow
```
PENDING → SUBMITTED → PROCESSING → COMPLETED → TERMINATED
```

### Communication Status Flow
```
PENDING → SENDING → SENT → DELIVERED → FAILED → RETRYING → ABANDONED
```
