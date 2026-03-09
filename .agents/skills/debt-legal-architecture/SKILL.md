---
name: debt-legal-architecture
description: Architecture specification for the Section 129 and Handover debt recovery solution. Use when implementing SQL tables, APIs, Service Bus queues, worker processes, or any debt/legal module. Covers hybrid architecture rules, processing patterns, business rules, audit requirements, and module breakdown.
---

# Debt & Legal Architecture Specification

The complete architecture for the Section 129 and Handover solution. Reference this skill when building SQL tables, APIs, Service Bus integration, worker processes, or any debt/legal module.

## Core Architecture

See `reference/architecture.md` for the full specification including:
- Hybrid architecture rules (sync API vs Azure Service Bus)
- Processing patterns for long-running jobs
- Core modules list
- Business rules
- Audit requirements
- Service Bus message types
- Deliverables checklist

## Key Principles

1. **Replit** = UI + rules engine + process orchestrator
2. **Platinum** = system of record (API only)
3. **Azure Service Bus** = long-running, heavy, retryable background jobs ONLY
4. **No Replit database for feature data** — only POS core tables (users, cashier_sessions, transactions)
5. **No fallback data, no mock responses in live flows**

## When Sync API vs Service Bus

### Use Direct APIs For:
- Configuration reads/saves
- Dropdowns and lookups
- Enquiry screens
- Run lists, account lists, handover lists
- Reports and downloads
- Normal status reads

### Use Azure Service Bus For:
- Section 129 trial/final run processing
- 14-workday lapse processing
- Handover batch/termination processing
- Bulk notice generation
- SMS/email/print batch generation
- Retryable communication failures
- Dashboard event updates requiring background processing

## Processing Pattern (All Long-Running Jobs)

```
1. Replit API receives user request
2. Validate input and permissions
3. Save process request header + audit entry via Platinum API
4. Publish message to Azure Service Bus
5. Background worker picks up message
6. Worker executes rules and processing
7. Worker writes all results back to Platinum through APIs
8. Worker updates status, audit, files, errors
9. Replit UI polls/refreshes job status
```

## Anti-Patterns (Never Do This)

- Run heavy trial/final/handover processing inside the browser
- Wait for long-running HTTP requests to finish in the UI
- Calculate legal results only in frontend state
- Update Platinum directly without audit metadata
- Use Service Bus for simple dropdowns or screen loads

## Core Modules

1. Configuration module
2. Rule engine
3. Trial review module
4. Trial run module
5. Authorisation module
6. Final run module
7. Lapse tracker
8. Handover module
9. Handover termination module
10. General enquiries module
11. Reports and file module
12. Audit and dashboard module

## Business Rules

- Only one enabled Section 129 config per financial year
- Lapse days are workdays
- Support Account, Bulk, and Rotation handover modes
- Exclude handed-over accounts
- Ignore RPP balances
- Exclude accounts with active clearances
- Final run must use approved trial data
- All handover and termination actions must be auditable
- All generated files must be tracked and downloadable
- All write actions must store user and timestamp details

## Audit Fields (Every Write)

| Field | Required |
|-------|----------|
| CapturerID | Always |
| DateCaptured | Always |
| ModifierID | Always |
| DateModified | Always |
| ReviewerID | Where applicable |
| ReviewDate | Where applicable |
| StatusID | Always |
| Comment/Notes | Where applicable |
| RunID / AccountID / HandoverID | Where applicable |

## Service Bus Messages

### Command Messages
- StartSection129TrialRun
- SubmitSection129TrialReview
- AuthorizeSection129Run
- StartSection129FinalRun
- ProcessLapseCheck
- StartHandoverSubmit
- StartHandoverTerminate
- GenerateRunFiles
- RetryCommunicationBatch

### Event Messages
- Section129TrialRunCompleted
- Section129FinalRunCompleted
- HandoverCompleted
- HandoverTerminationCompleted
- CommunicationBatchFailed

## Required Deliverables (Before Deep Coding)

1. Final architecture diagram
2. API list
3. Service Bus queue/topic design
4. Worker process design
5. Table-to-process mapping
6. Status matrix
7. Audit matrix
8. Error/retry strategy
9. Requirement compliance checklist
