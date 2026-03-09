---
name: phase-deliverables
description: Standard 5-output deliverable template for each development phase. Use when starting any new phase (Phase 2, 3, 4, etc.) to produce consistent deliverables for API teams, DBAs, and project leads.
---

# Phase Deliverables Template

Every phase produces exactly 5 output files. No exceptions.

## Output Files

For Phase N covering page "{PageName}":

### 1. `PHASE{N}_{PAGENAME}_DETAIL_PACK.md`
The master design document. Contains:
- Screen breakdown (every field, filter, grid, button, action)
- Page logic (load, submit, clear, navigation)
- Business rules (numbered, with enforcement location and sync/async)
- API list (endpoint, method, purpose, payload, response, validations, errors, audit, statuses)
- Swagger-ready contracts (JSON schemas, examples, error examples)
- Database mapping (tables reused, fields used, missing fields, new tables)
- Sync vs async matrix
- Status and audit mapping
- Open gaps / blockers

### 2. `PHASE{N}_BLOCKERS_ACTION_LIST.md`
Short action list. One section per blocker with:
- Blocker ID
- Description
- Why it blocks
- DB change needed
- API impact
- Frontend impact
- Owner
- Decision needed

### 3. `PHASE{N}_API_DEVELOPER_HANDOVER.md`
Shortened API-only pack. Contains:
- API list table
- Swagger request/response schemas with examples
- Validation rules per endpoint
- Status transitions (diagram + table)
- Audit fields per step
- DB changes required (ALTER + CREATE + field mapping)
- Service Bus commands
- Worker jobs

### 4. `PHASE{N}_DB_CHANGE_SCRIPT.sql`
Executable SQL file. Contains:
- ALTER TABLE statements (with IF NOT EXISTS guards)
- CREATE TABLE statements (with IF NOT EXISTS guards)
- Foreign keys
- Indexes
- Verification queries
- Rollback script (commented out)
All statements must be idempotent.

### 5. `PHASE{N}_SIGNOFF_CHECKLIST.md`
Checklist table with columns: #, Category, Item, Owner, Status, Sign-off, Date.
Categories: Frontend, API Contract, DB Changes, Swagger, Service Bus, Worker Logic, Blockers.
Bottom: summary table + formal approval section with signature rows.
Phase N+1 does not start until all items are signed off.

## Process Order

1. Create master detail pack (explore frontend page + backend routes + EMS schema)
2. Extract blockers from the detail pack
3. Extract DB script from the detail pack
4. Extract API handover from the detail pack
5. Extract Service Bus pack from the detail pack
6. Create signoff checklist covering all 5 outputs
7. Get sign-off before moving to next phase

## Naming Convention

- Page name in filenames uses UPPER_SNAKE_CASE
- Example: Phase 2 = Section 129 Configuration → `PHASE2_SECTION129_CONFIG_*`
- Example: Phase 7 = Handover Management → `PHASE7_HANDOVER_MANAGEMENT_*`

## Key Rules

- Focus on ONE page per phase only
- No summary language — implementation detail only
- Use existing frontend page and EMS schema together
- All data from Platinum API only — no local DB for feature data
- Every API endpoint must show: payload, response, validations, errors, audit fields, status updates
- Every DB change must be idempotent with rollback
- Every Service Bus message must define retry and failure handling
